"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface AuthState {
  error?: string;
  message?: string;
}

const NOT_CONFIGURED: AuthState = {
  error:
    "O quadro ainda não está conectado ao banco. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (ver DEPLOY.md).",
};

/** Traduz os erros do Supabase Auth para a linguagem do quadro. */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar na taverna.";
  }
  // Erro de CONFIGURAÇÃO, não do jogador: o provedor de e-mail está desligado
  // no painel do Supabase. A mensagem diz onde arrumar, senão vira um
  // "não funciona" sem pista nenhuma.
  if (m.includes("signups are disabled") || m.includes("signup is disabled")) {
    return (
      "O cadastro por e-mail está desligado no Supabase. Ligue em " +
      "Authentication → Sign In / Providers → Email (o interruptor do provedor, " +
      "não o de confirmação)."
    );
  }
  if (m.includes("logins are disabled") || m.includes("provider is not enabled")) {
    return (
      "O login por e-mail está desligado no Supabase. Ligue em " +
      "Authentication → Sign In / Providers → Email."
    );
  }
  if (m.includes("is invalid") && m.includes("email")) {
    return "Esse endereço de e-mail não foi aceito. Tente outro.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Já existe uma conta com esse e-mail. Entre em vez de criar.";
  }
  if (m.includes("password should be at least")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Muitas tentativas seguidas. Espere um instante e tente de novo.";
  }
  if (m.includes("duplicate key") && m.includes("username")) {
    return "Esse nome de jogador já está em uso. Escolha outro.";
  }
  return message;
}

function safeNext(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  // Só caminho interno — nunca redireciona para fora do app.
  return value.startsWith("/") && !value.startsWith("//") ? value : "/quadro";
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: translateAuthError(error.message) };

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const username = String(formData.get("username") ?? "").trim();

  if (!email || !password || !username) {
    return { error: "Preencha nome, e-mail e senha." };
  }
  if (username.length < 2 || username.length > 24) {
    return { error: "O nome do jogador precisa ter entre 2 e 24 caracteres." };
  }
  if (password.length < 6) {
    return { error: "A senha precisa ter pelo menos 6 caracteres." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // O trigger handle_new_user lê daqui para criar o perfil.
    options: { data: { username } },
  });

  if (error) return { error: translateAuthError(error.message) };

  // Sem sessão = o projeto exige confirmação de e-mail.
  if (!data.session) {
    return {
      message:
        "Conta criada. Confirme o e-mail que acabamos de enviar e depois entre na taverna.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/quadro");
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/entrar");
}
