import { AuthForm } from "./auth-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupNotice } from "@/components/setup-notice";

export const metadata = { title: "Entrar na taverna · Quadro de Missões" };

export const dynamic = "force-dynamic";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ proxima?: string }>;
}) {
  if (!isSupabaseConfigured) return <SetupNotice />;

  const { proxima } = await searchParams;
  const next = proxima && proxima.startsWith("/") ? proxima : "/quadro";

  return <AuthForm next={next} />;
}
