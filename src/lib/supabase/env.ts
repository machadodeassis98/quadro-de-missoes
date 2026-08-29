/**
 * Leitura e validação das variáveis de ambiente do Supabase.
 *
 * Elas são públicas por natureza (a anon key é feita para ir ao navegador —
 * quem protege os dados é a RLS, não o segredo da chave). Ainda assim nunca
 * ficam hardcoded: vêm de `.env.local` / das env vars da Vercel.
 *
 * A validação existe porque um valor malformado (o caso clássico: colar
 * `NEXT_PUBLIC_SUPABASE_URL=https://...` inteiro dentro do campo de VALOR no
 * painel da Vercel) faz o `createServerClient` lançar exceção. Como o
 * `proxy.ts` roda em toda requisição, isso derrubava o site inteiro com 500 —
 * inclusive a página que deveria explicar o que está errado. Agora um valor
 * inválido é tratado como "não configurado" e vira uma tela com instruções.
 */

// As referências a process.env precisam ser estáticas: é assim que o Next
// substitui o valor no bundle. Nada de process.env[nomeDinamico] aqui.
const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const rawKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const SUPABASE_URL = rawUrl;
export const SUPABASE_ANON_KEY = rawKey;

export const isSupabaseConfigured = isHttpUrl(rawUrl) && rawKey.length > 0;

/** O que exatamente está errado, em português, para a tela de configuração. */
export function supabaseConfigProblem(): string | null {
  if (isSupabaseConfigured) return null;

  if (!rawUrl) {
    return "NEXT_PUBLIC_SUPABASE_URL não está definida.";
  }
  if (!isHttpUrl(rawUrl)) {
    // O erro mais comum de todos, e o mais difícil de enxergar sozinho.
    const parece = rawUrl.includes("=")
      ? " Parece que o nome da variável foi colado junto com o valor — o campo de valor deve conter só a URL."
      : " O valor precisa começar com https://.";
    return `NEXT_PUBLIC_SUPABASE_URL tem um valor inválido.${parece}`;
  }
  return "NEXT_PUBLIC_SUPABASE_ANON_KEY não está definida.";
}

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      `Supabase não configurado: ${supabaseConfigProblem()} ` +
        "Ver .env.example e DEPLOY.md.",
    );
  }
}
