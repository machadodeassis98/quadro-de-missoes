/**
 * Leitura das variáveis de ambiente do Supabase, num lugar só.
 *
 * Elas são públicas por natureza (a anon key é feita para ir ao navegador —
 * quem protege os dados é a RLS, não o segredo da chave). Ainda assim nunca
 * ficam hardcoded: vêm de `.env.local` / das env vars da Vercel.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Falso quando o projeto ainda não foi configurado — a UI avisa em vez de quebrar. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local (ver .env.example e DEPLOY.md).",
    );
  }
}
