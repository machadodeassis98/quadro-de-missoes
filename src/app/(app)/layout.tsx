import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupNotice } from "@/components/setup-notice";
import { BoardProvider } from "@/lib/data/board-provider";
import { AppNav } from "@/components/app-nav";
import { Toaster } from "@/components/ui/toaster";
import type { Profile } from "@/lib/types/database";

/**
 * O quadro é sempre renderizado por requisição: o conteúdo depende da sessão
 * de quem pediu. Sem isto, um build feito sem as variáveis de ambiente
 * congelaria o aviso de configuração dentro do HTML das páginas.
 */
export const dynamic = "force-dynamic";

/**
 * Layout das rotas protegidas.
 *
 * A sessão é conferida aqui no servidor (além do middleware) — quem chega sem
 * sessão nunca chega a receber HTML do quadro. O BoardProvider, cliente, cuida
 * dos dados e do tempo real a partir daqui para baixo.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured) return <SetupNotice />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // O perfil nasce por trigger no cadastro. Se faltar, algo saiu do lugar no
  // banco — melhor mandar refazer o login do que renderizar um quadro sem dono.
  if (!profile) redirect("/entrar");

  return (
    <BoardProvider profile={profile as Profile}>
      <div className="min-h-dvh bg-ink">
        <AppNav />
        <main className="max-w-3xl mx-auto px-4 sm:px-5 py-6 pb-24">{children}</main>
        <Toaster />
      </div>
    </BoardProvider>
  );
}
