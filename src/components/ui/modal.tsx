"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Modal de pergaminho.
 *
 * Diferenças em relação ao protótipo, todas de usabilidade — o visual é o
 * mesmo: fecha no Esc, trava o scroll do fundo, devolve o foco ao fechar e usa
 * `100dvh` para a ficha (que é longa) rolar direito no celular, onde a barra
 * do navegador aparece e some.
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[rgba(10,8,5,0.72)]"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={[
          "w-full sm:max-w-lg bg-panel border border-brass-dim rounded-t-[3px] sm:rounded-[2px]",
          "shadow-[0_20px_60px_rgba(0,0,0,0.6)] outline-none",
          "flex flex-col max-h-[92dvh] sm:max-h-[88dvh]",
        ].join(" ")}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-brass-dim/35 shrink-0">
          <h3 className="font-display font-bold text-ink-text text-lg pr-2">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1 text-muted hover:opacity-70 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto grow">{children}</div>

        {footer && (
          <div className="px-5 py-3 border-t border-brass-dim/20 shrink-0 bg-panel">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Confirmação antes de ação destrutiva (cancelar missão, arquivar ficha).
 * O protótipo não tinha nenhuma — dava para cancelar uma missão sem aviso.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  destructive = true,
  busy = false,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  destructive?: boolean;
  busy?: boolean;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="font-body text-[14px] text-ink-text">{message}</p>
      <div className="flex justify-end gap-2 mt-5">
        <button
          type="button"
          onClick={onClose}
          className="font-display font-semibold text-[13px] px-4 py-2 rounded-[2px] border border-muted/50 text-ink-text cursor-pointer hover:opacity-85"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={[
            "font-display font-semibold text-[13px] px-4 py-2 rounded-[2px] cursor-pointer hover:opacity-85",
            destructive
              ? "bg-blood text-panel border border-[#6B2B25]"
              : "bg-brass text-ink border border-brass-dim",
            busy ? "opacity-45 cursor-not-allowed" : "",
          ].join(" ")}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
