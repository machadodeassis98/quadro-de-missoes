import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupNotice } from "@/components/setup-notice";

export const dynamic = "force-dynamic";

export default function Home() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  // O proxy (src/proxy.ts) manda para /entrar quem não tem sessão.
  redirect("/quadro");
}
