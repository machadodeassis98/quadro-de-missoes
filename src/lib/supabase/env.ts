/**
 * Leitura e validação das variáveis de ambiente do Supabase.
 *
 * Lido SÓ NO SERVIDOR (páginas, layouts, Server Actions e `proxy.ts`). O
 * cliente do navegador recebe a configuração por props — ver
 * `src/lib/supabase/client.ts`.
 *
 * Aceita dois nomes para cada valor:
 *
 *   SUPABASE_URL              (preferido)
 *   NEXT_PUBLIC_SUPABASE_URL  (compatibilidade)
 *
 * O par sem prefixo é o preferido porque a Vercel trata variáveis
 * `NEXT_PUBLIC_*` como públicas e nem sempre permite criá-las assim. Sem o
 * prefixo, o valor não é injetado no bundle em tempo de build — ele é lido em
 * tempo de execução e repassado ao navegador pelo layout. Na prática o valor
 * continua chegando ao navegador (é inevitável num app que fala direto com o
 * Supabase pelo cliente); o que muda é a classificação na Vercel e o fato de
 * que alterar a variável passa a valer sem precisar de rebuild.
 *
 * As referências a process.env são estáticas de propósito: é assim que o Next
 * consegue substituí-las. Nada de process.env[nomeDinamico] aqui.
 */

const rawUrl = (
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  ""
).trim();

const rawKey = (
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ""
).trim();

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * O erro clássico: colar `SUPABASE_ANON_KEY=eyJ...` inteiro dentro do campo de
 * VALOR no painel. A chave não tem formato fixo o bastante para validar de
 * verdade, mas esse caso dá para pegar — e sem isto ele viraria um 401 obscuro
 * em toda requisição.
 */
const keyLooksPasted = /^(NEXT_PUBLIC_)?SUPABASE_ANON_KEY=/.test(rawKey);

export const SUPABASE_URL = rawUrl;
export const SUPABASE_ANON_KEY = rawKey;

export const isSupabaseConfigured =
  isHttpUrl(rawUrl) && rawKey.length > 0 && !keyLooksPasted;

/** O que exatamente está errado, em português, para a tela de configuração. */
export function supabaseConfigProblem(): string | null {
  if (isSupabaseConfigured) return null;

  if (!rawUrl) {
    return "SUPABASE_URL não está definida.";
  }
  if (!isHttpUrl(rawUrl)) {
    const parece = rawUrl.includes("=")
      ? " Parece que o nome da variável foi colado junto com o valor — o campo de valor deve conter só a URL."
      : " O valor precisa começar com https://.";
    return `SUPABASE_URL tem um valor inválido.${parece}`;
  }
  if (keyLooksPasted) {
    return (
      "SUPABASE_ANON_KEY tem o nome da variável colado junto com o valor — " +
      "o campo de valor deve conter só a chave."
    );
  }
  return "SUPABASE_ANON_KEY não está definida.";
}

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      `Supabase não configurado: ${supabaseConfigProblem()} ` +
        "Ver .env.example e DEPLOY.md.",
    );
  }
}
