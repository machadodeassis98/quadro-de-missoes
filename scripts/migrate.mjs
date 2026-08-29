#!/usr/bin/env node
/**
 * Aplica as migrations de `supabase/migrations/` na ordem numérica.
 *
 * Alternativa ao SQL Editor do painel: mesmo resultado, mas repetível e
 * scriptável. Cada arquivo roda dentro da própria transação — se um falhar,
 * ele é desfeito por inteiro e o processo para ali, sem deixar o banco
 * meio migrado.
 *
 *   DATABASE_URL="postgresql://postgres:<senha>@db.<ref>.supabase.co:5432/postgres" \
 *     node scripts/migrate.mjs
 *
 * A connection string está no painel do Supabase em
 * Project Settings > Database > Connection string > URI.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "migrations",
);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "DATABASE_URL não definida.\n" +
      "Pegue em: Supabase > Project Settings > Database > Connection string > URI",
  );
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  // O Supabase serve TLS com certificado próprio; sem isto o Node recusa.
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  const all = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

  // Sem argumento, roda todas na ordem. Com argumento(s), roda só o que foi
  // pedido — útil para reaplicar uma migration corrigida sobre um banco que
  // já existe (0002 em diante são reaplicáveis: `create or replace`).
  const wanted = process.argv.slice(2);
  const files =
    wanted.length === 0
      ? all
      : wanted.map((w) => {
          const match = all.find((f) => f === w || f.startsWith(w));
          if (!match) {
            console.error(`Migration não encontrada: ${w}`);
            process.exit(1);
          }
          return match;
        });

  if (files.length === 0) {
    console.error("Nenhuma migration encontrada em supabase/migrations/.");
    process.exit(1);
  }

  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    process.stdout.write(`→ ${file} ... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("commit");
      console.log("ok");
    } catch (error) {
      await client.query("rollback").catch(() => {});
      console.log("FALHOU");
      console.error(`\n${file}: ${error.message}`);
      if (error.position) {
        // Mostra o trecho exato que o Postgres recusou.
        const pos = Number(error.position);
        console.error(
          `\ncontexto:\n...${sql.slice(Math.max(0, pos - 200), pos + 200)}...`,
        );
      }
      process.exit(1);
    }
  }

  console.log(`\n${files.length} migration(s) aplicadas.`);
} finally {
  await client.end().catch(() => {});
}
