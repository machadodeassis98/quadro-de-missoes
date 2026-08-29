"use client";

import { useEffect, useState } from "react";
import { Coins, Gem, Skull, Sparkles, Star } from "lucide-react";
import { loadCharacterHistory, QuadroError } from "@/lib/data/api";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/primitives";
import type { CharacterView, HistoryEntry } from "@/lib/types/database";

/**
 * Histórico de aventuras da ficha.
 *
 * É o que responde "de onde veio esse XP?": cada linha é um `character_event`
 * gravado pela RPC de resolução, com os itens daquela missão junto. Permanente
 * — arquivar a ficha não apaga nada.
 */
export function HistoryModal({
  character,
  onClose,
}: {
  character: CharacterView;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // `cancelled` evita gravar estado depois que o modal fechou.
    let cancelled = false;

    loadCharacterHistory(character.id)
      .then((result) => {
        if (cancelled) return;
        setEntries(result);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof QuadroError ? e.message : "Não foi possível carregar o histórico.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [character.id, attempt]);

  const retry = () => {
    setEntries(null);
    setError(null);
    setAttempt((n) => n + 1);
  };

  return (
    <Modal title={`Histórico de ${character.name}`} onClose={onClose}>
      {error && <ErrorState message={error} onRetry={retry} />}
      {!error && entries === null && <LoadingState label="Abrindo o diário..." />}
      {!error && entries?.length === 0 && (
        <EmptyState>
          Nenhuma aventura registrada ainda. Inscreva esta ficha em uma missão do quadro.
        </EmptyState>
      )}

      {entries && entries.length > 0 && (
        <ol className="space-y-2.5">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="p-3 rounded-[2px] bg-panel-light border border-brass-dim/30"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-display font-bold text-ink-text text-[15px]">
                  {entry.missionTitle ?? labelFor(entry.event_type)}
                </p>
                <time
                  dateTime={entry.created_at}
                  className="font-mono text-[10.5px] text-muted shrink-0"
                >
                  {new Date(entry.created_at).toLocaleDateString("pt-BR")}
                </time>
              </div>

              {entry.event_type === "mission_death" && (
                <p className="flex items-center gap-1.5 font-body text-[13px] text-blood mt-1">
                  <Skull size={13} aria-hidden /> {entry.description}
                </p>
              )}

              {entry.event_type === "level_up" && (
                <p className="flex items-center gap-1.5 font-body text-[13px] text-brass-dim mt-1">
                  <Star size={13} aria-hidden /> {entry.description}
                </p>
              )}

              {entry.event_type === "mission_reward" && (
                <>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 font-mono text-[12px]">
                    {entry.xp_delta > 0 && (
                      <span className="text-ink-text">+{entry.xp_delta} XP</span>
                    )}
                    {entry.gold_delta > 0 && (
                      <span className="flex items-center gap-1 text-brass-dim">
                        <Coins size={12} aria-hidden />+{entry.gold_delta} PO
                      </span>
                    )}
                    {entry.reputation_delta > 0 && (
                      <span className="flex items-center gap-1 text-muted">
                        <Sparkles size={12} aria-hidden />+{entry.reputation_delta} REP
                      </span>
                    )}
                  </div>
                  {entry.items.length > 0 && (
                    <p className="flex items-start gap-1.5 font-body text-[12.5px] text-muted mt-1.5">
                      <Gem size={12} className="mt-1 shrink-0" aria-hidden />
                      {entry.items.map((i) => i.name).join(" · ")}
                    </p>
                  )}
                </>
              )}

              {entry.event_type === "character_created" && (
                <p className="font-body text-[12.5px] text-muted mt-1">
                  {entry.description}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

function labelFor(type: HistoryEntry["event_type"]): string {
  switch (type) {
    case "character_created":
      return "Ficha registrada";
    case "level_up":
      return "Subiu de nível";
    case "mission_death":
      return "Caiu em missão";
    case "manual_adjustment":
      return "Ajuste do mestre";
    default:
      return "Missão";
  }
}
