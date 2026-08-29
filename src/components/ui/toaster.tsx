"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import { useBoard } from "@/lib/data/board-provider";

/**
 * Retorno das ações ("Missão publicada.", "Você já possui 3 fichas ativas.").
 * O protótipo não dava nenhum: falha de escrita ia para o console e a tela
 * seguia como se tivesse salvado.
 */
export function Toaster() {
  const { toasts, dismissToast } = useBoard();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-[60] bottom-3 left-1/2 -translate-x-1/2 w-[min(94vw,26rem)] flex flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={[
            "flex items-start gap-2 px-3.5 py-2.5 rounded-[2px] shadow-[0_8px_24px_rgba(0,0,0,0.45)]",
            toast.tone === "error"
              ? "bg-blood text-panel border border-[#6B2B25]"
              : "bg-panel text-ink-text border border-brass-dim",
          ].join(" ")}
        >
          {toast.tone === "error" ? (
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          ) : (
            <Check size={15} className="mt-0.5 shrink-0 text-moss" />
          )}
          <p className="font-body text-[13px] leading-snug grow">{toast.message}</p>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dispensar aviso"
            className="shrink-0 opacity-60 hover:opacity-100 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
