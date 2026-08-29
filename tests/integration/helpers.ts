/**
 * Infra dos testes de integração.
 *
 * As contas de teste nascem direto no Postgres (com senha bcrypt), e não pela
 * API de admin — assim a suíte roda com a `DATABASE_URL` e a anon key, sem
 * precisar da `service_role` key em lugar nenhum.
 *
 * Tudo o que é criado leva o prefixo desta execução no e-mail, e o `afterAll`
 * apaga por esse prefixo: o banco volta ao estado anterior mesmo se um teste
 * falhar no meio.
 */

import pg from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const DB_URL = process.env.DATABASE_URL ?? "";

// Mesma ordem de preferência do app (ver src/lib/supabase/env.ts): nome
// dedicado de teste, depois o sem prefixo, depois o com prefixo.
export const SB_URL =
  process.env.SUPABASE_TEST_URL ??
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "";
export const SB_KEY =
  process.env.SUPABASE_TEST_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/** A suíte inteira pula quando o ambiente não está configurado. */
export const integrationReady = Boolean(DB_URL && SB_URL && SB_KEY);

/** Domínio reservado pela IANA: nunca entrega e-mail de verdade. */
export const RUN_TAG = `it${Date.now().toString(36)}`;
const EMAIL_DOMAIN = "quadro-integration.example.com";

export const TEST_PASSWORD = "taverna-1234";

export interface TestUser {
  id: string;
  username: string;
  email: string;
  /** Cliente autenticado como este usuário — o mesmo que o app usa. */
  db: SupabaseClient;
}

let client: pg.Client | null = null;
let pgcryptoSchema = "extensions";

export async function openDatabase(): Promise<pg.Client> {
  if (client) return client;
  client = new pg.Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const { rows } = await client.query(
    `select n.nspname from pg_extension e
     join pg_namespace n on n.oid = e.extnamespace
     where e.extname = 'pgcrypto'`,
  );
  pgcryptoSchema = rows[0]?.nspname ?? "public";
  return client;
}

export async function closeDatabase(): Promise<void> {
  await client?.end();
  client = null;
}

/**
 * Apaga tudo o que esta execução criou.
 *
 * As guildas saem primeiro: `guilds.founder_id` é `on delete restrict` de
 * propósito (guilda não perde o fundador em silêncio), então apagar o perfil
 * antes seria bloqueado pela foreign key. O resto cai em cascata a partir de
 * auth.users.
 */
export async function cleanupRun(): Promise<void> {
  if (!client) return;
  const pattern = `${RUN_TAG}-%@${EMAIL_DOMAIN}`;

  await client.query(
    `delete from guilds where founder_id in (
       select id from auth.users where email like $1
     )`,
    [pattern],
  );
  await client.query(`delete from auth.users where email like $1`, [pattern]);
}

export async function createUser(username: string): Promise<TestUser> {
  const db = await openDatabase();
  const email = `${RUN_TAG}-${username.toLowerCase()}@${EMAIL_DOMAIN}`;

  // As colunas de token precisam de string vazia: o GoTrue lê cada uma num
  // campo string do Go e responde "Database error querying schema" com NULL.
  const { rows } = await db.query(
    `insert into auth.users (
       id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
       created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
       confirmation_token, recovery_token, email_change_token_new, email_change,
       email_change_token_current, phone_change, phone_change_token, reauthentication_token
     ) values (
       gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', $1,
       ${pgcryptoSchema}.crypt($2, ${pgcryptoSchema}.gen_salt('bf')),
       now(), now(), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('username', $3::text),
       '', '', '', '', '', '', '', ''
     )
     returning id`,
    [email, TEST_PASSWORD, `${username}-${RUN_TAG}`],
  );

  const supabase = createClient(SB_URL, SB_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`login de ${username} falhou: ${error.message}`);

  return { id: rows[0].id, username, email, db: supabase };
}

/** Leitura administrativa, sem RLS — para conferir o que o app gravou. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = await openDatabase();
  const { rows } = await db.query(sql, params);
  return rows as T[];
}

export async function createCharacter(
  user: TestUser,
  name: string,
  overrides: Record<string, unknown> = {},
) {
  const { data, error } = await user.db
    .from("characters")
    .insert({ user_id: user.id, name, class: "Guerreiro", race: "Humano", ...overrides })
    .select()
    .single();
  if (error) throw new Error(`criar ficha ${name}: ${error.message}`);
  return data as { id: string; name: string };
}

export async function createMission(
  dm: TestUser,
  overrides: Record<string, unknown> = {},
) {
  const { data, error } = await dm.db
    .from("missions")
    .insert({
      dm_id: dm.id,
      title: `Missão ${RUN_TAG}`,
      description: "teste de integração",
      scheduled_at: new Date().toISOString(),
      min_level: 1,
      max_level: 4,
      max_players: 4,
      min_players: 1,
      rank: "D",
      ...overrides,
    })
    .select()
    .single();
  if (error) throw new Error(`criar missão: ${error.message}`);
  return data as { id: string; title: string; status: string };
}

export async function participantOf(missionId: string, characterId: string) {
  const rows = await query<{ id: string; status: string }>(
    `select id, status from mission_participants
     where mission_id = $1 and character_id = $2`,
    [missionId, characterId],
  );
  return rows[0];
}
