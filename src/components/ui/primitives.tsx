"use client";

/**
 * Primitivas visuais do quadro — porte direto do protótipo.
 * Os tokens (latão, pergaminho, sangue, musgo) e as três fontes são os mesmos;
 * o que mudou é que agora são classes Tailwind sobre CSS variables em vez de
 * objetos de estilo inline.
 */

import { Loader2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Botão de latão                                                     */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "ghost" | "danger" | "moss";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brass text-ink border border-brass-dim",
  ghost: "bg-transparent text-ink-text border border-muted/50",
  danger: "bg-blood text-panel border border-[#6B2B25]",
  moss: "bg-moss text-panel border border-[#2E4331]",
};

export function BrassButton({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled = false,
  small = false,
  title,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  type?: "button" | "submit";
  disabled?: boolean;
  small?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        VARIANTS[variant],
        small ? "px-3 py-[5px] text-xs" : "px-4 py-2 text-[13px]",
        "font-display font-semibold tracking-[0.03em] rounded-[2px] whitespace-nowrap",
        "transition-opacity hover:opacity-85",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass",
        disabled ? "opacity-45 cursor-not-allowed" : "cursor-pointer",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Campos de formulário                                               */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block mb-3">
      <span className="q-label">{label}</span>
      {children}
      {hint && (
        <span className="block mt-1 font-body text-[11px] italic text-muted">{hint}</span>
      )}
    </label>
  );
}

export function NumberBox({
  value,
  onChange,
  width = 52,
  min = 0,
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  width?: number;
  min?: number;
  ariaLabel?: string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      aria-label={ariaLabel}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(e.target.value === "" ? min : Number(e.target.value))}
      style={{ width }}
      className="q-input font-mono text-center max-w-full"
    />
  );
}

/** Valor só de leitura (nível, XP, ouro, reputação — o jogador não edita). */
export function StatReadout({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-2 rounded-[2px] text-center bg-panel-light border border-brass-dim/35">
      <p className="font-mono text-[9.5px] uppercase text-muted mb-0.5">{label}</p>
      <p className="font-display font-bold text-ink-text text-base">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Estados de carga / vazio / erro                                    */
/* ------------------------------------------------------------------ */

export function Spinner({ size = 20 }: { size?: number }) {
  return <Loader2 size={size} className="q-spin text-brass" aria-hidden />;
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-2.5 py-10 justify-center"
      role="status"
      aria-live="polite"
    >
      <Spinner />
      <span className="font-body text-sm text-faint">{label}</span>
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="font-body italic text-faint-dim py-2">{children}</p>;
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="rounded-[2px] p-4 border border-blood/60 bg-blood/10"
      role="alert"
    >
      <p className="font-body text-sm text-[#E5B4AE]">{message}</p>
      {onRetry && (
        <div className="mt-3">
          <BrassButton small variant="ghost" onClick={onRetry} className="!text-panel">
            Tentar de novo
          </BrassButton>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Cabeçalho de seção (o "N missão(ões) em aberto" + ação)            */
/* ------------------------------------------------------------------ */

export function SectionBar({
  caption,
  children,
}: {
  caption: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
      <p className="font-body text-[13px] text-faint">{caption}</p>
      {children}
    </div>
  );
}

/** Rótulo de seção em versalete monoespaçado, como no protótipo. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase text-faint-dim mt-8 mb-3">{children}</p>
  );
}
