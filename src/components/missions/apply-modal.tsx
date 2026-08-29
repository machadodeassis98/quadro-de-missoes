"use client";

import { ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/primitives";
import { levelFromXp } from "@/lib/domain/rules";
import type { CharacterView, MissionView } from "@/lib/types/database";

/**
 * Escolha da ficha para se inscrever.
 *
 * Só entram fichas vivas e ativas — ficha morta não volta ao quadro (morte é
 * permanente) e ficha arquivada está fora de circulação. O banco rejeita as
 * duas de novo, na RPC.
 */
export function ApplyModal({
  mission,
  characters,
  onClose,
  onApply,
  busy,
}: {
  mission: MissionView;
  characters: CharacterView[];
  onClose: () => void;
  onApply: (characterId: string) => void;
  busy: boolean;
}) {
  const eligible = characters.filter((c) => c.status === "alive" && c.active);

  return (
    <Modal title={`Inscrever-se: ${mission.title}`} onClose={onClose}>
      {eligible.length === 0 ? (
        <EmptyState>
          Você não tem fichas vivas disponíveis. Cadastre uma nova na aba Minhas Fichas.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          <p className="font-body text-[13px] text-muted mb-1">
            Uma ficha por jogador em cada missão. O mestre ainda precisa aprovar.
          </p>
          {eligible.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={busy}
              onClick={() => onApply(c.id)}
              className="w-full flex items-center justify-between p-3 rounded-[2px] text-left bg-panel-light border border-brass-dim/35 hover:opacity-85 disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
            >
              <div className="min-w-0">
                <p className="font-display font-bold text-ink-text truncate">{c.name}</p>
                <p className="font-body text-xs text-muted">
                  {c.class} · Nível {levelFromXp(c.xp)}
                </p>
              </div>
              <ChevronRight size={18} className="text-brass-dim shrink-0" aria-hidden />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
