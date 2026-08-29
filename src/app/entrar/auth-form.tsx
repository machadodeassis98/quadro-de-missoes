"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ScrollText } from "lucide-react";
import { signIn, signUp, type AuthState } from "./actions";

/**
 * O portão da taverna.
 *
 * Mesma composição do protótipo — ícone de pergaminho, título em Cinzel,
 * subtítulo e campo centralizado sobre o fundo escuro. O que era só "digite um
 * nome" agora é autenticação real; o nome virou o username da conta.
 */
export function AuthForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"entrar" | "cadastrar">("entrar");

  return mode === "entrar" ? (
    <SignInForm next={next} onSwitch={() => setMode("cadastrar")} />
  ) : (
    <SignUpForm onSwitch={() => setMode("entrar")} />
  );
}

function Shell({
  subtitle,
  children,
}: {
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-ink">
      <div className="w-full max-w-sm text-center">
        <ScrollText size={40} className="text-brass mx-auto mb-3.5" aria-hidden />
        <h1 className="font-display font-bold text-panel text-2xl sm:text-[26px]">
          Quadro de Missões
        </h1>
        <p className="font-body text-faint text-sm mt-2 mb-6">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

const DARK_INPUT =
  "q-input text-center !bg-ink-soft !text-panel !border-brass-dim placeholder:!text-[#7d735c]";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={[
        "bg-brass text-ink border border-brass-dim font-display font-semibold",
        "tracking-[0.03em] text-[13px] px-4 py-2 rounded-[2px] w-full",
        "transition-opacity hover:opacity-85 cursor-pointer",
        pending ? "opacity-45 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {pending ? "Abrindo a porta..." : label}
    </button>
  );
}

function Feedback({ state }: { state: AuthState }) {
  if (state.error) {
    return (
      <p className="font-body text-[13px] text-[#E5B4AE] mt-3" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p className="font-body text-[13px] text-[#A8C3AB] mt-3" role="status">
        {state.message}
      </p>
    );
  }
  return null;
}

function SwitchLink({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-5 font-body text-[13px] text-faint underline underline-offset-4 hover:text-brass cursor-pointer"
    >
      {children}
    </button>
  );
}

function SignInForm({ next, onSwitch }: { next: string; onSwitch: () => void }) {
  const [state, action] = useActionState<AuthState, FormData>(signIn, {});

  return (
    <Shell subtitle="Diga quem você é antes de entrar na taverna.">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="Seu e-mail"
          className={DARK_INPUT}
        />
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Sua senha"
          className={DARK_INPUT}
        />
        <SubmitButton label="Entrar na taverna" />
      </form>
      <Feedback state={state} />
      <SwitchLink onClick={onSwitch}>Ainda não tem conta? Registre-se na guilda</SwitchLink>
    </Shell>
  );
}

function SignUpForm({ onSwitch }: { onSwitch: () => void }) {
  const [state, action] = useActionState<AuthState, FormData>(signUp, {});

  return (
    <Shell subtitle="Diga como o grupo deve te chamar antes de entrar na taverna.">
      <form action={action} className="flex flex-col gap-3">
        <input
          name="username"
          type="text"
          autoComplete="nickname"
          required
          minLength={2}
          maxLength={24}
          placeholder="Seu nome"
          className={DARK_INPUT}
        />
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="Seu e-mail"
          className={DARK_INPUT}
        />
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          placeholder="Uma senha (mín. 6 caracteres)"
          className={DARK_INPUT}
        />
        <SubmitButton label="Registrar na guilda" />
      </form>
      <Feedback state={state} />
      <SwitchLink onClick={onSwitch}>Já tem conta? Entrar na taverna</SwitchLink>
    </Shell>
  );
}
