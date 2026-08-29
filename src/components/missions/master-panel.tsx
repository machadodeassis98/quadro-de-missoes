"use client";

import { Ban, BookOpen, Check, UserMinus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { BrassButton, EmptyState } from "@/components/ui/primitives";
import {
  MISSION_STATUS_LABEL,
  levelFromXp,
  titleFromReputation,
} from "@/lib/domain/rules";
import type { MissionView, ParticipantView } from "@/lib/types/database";

/**
 * Painel do mestre — administração da missão dele.
 *
 * Mostra as inscrições pendentes com o que importa para decidir (personagem,
 * jogador, classe, raça, nível, reputação, guilda), e os confirmados com a
 * opção de remover. Quem entra aqui é sempre o dono da missão: a RPC
 * `decide_participation` confere de novo no banco.
 */
export function MasterPanel({
  mission,
  onClose,
  onDecide,
  onResolve,
  busy,
}: {
  mission: MissionView;
  onClose: () => void;
  onDecide: (participantId: string, decision: "approved" | "rejected") => void;
  onResolve: () => void;
  busy: boolean;
}) {
  const pending = mission.participants.filter((p) => p.status === "pending");
  const approved = mission.participants.filter((p) => p.status === "approved");
  const rejected = mission.participants.filter(
    (p) => p.status === "rejected" || p.status === "cancelled",
  );

  const canResolve =
    approved.length >= mission.min_players &&
    mission.status !== "completed" &&
    mission.status !== "cancelled";

  return (
    <Modal
      title={`Painel do mestre: ${mission.title}`}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-muted">
            {approved.length}/{mission.max_players} confirmados · mín.{" "}
            {mission.min_players} · {MISSION_STATUS_LABEL[mission.status]}
          </span>
          <BrassButton
            disabled={!canResolve || busy}
            onClick={onResolve}
            title={
              canResolve
                ? undefined
                : `Confirme pelo menos ${mission.min_players} participante(s) para resolver.`
            }
          >
            Resolver missão
          </BrassButton>
        </div>
      }
    >
      <section className="mb-5">
        <p className="font-mono text-[10px] uppercase text-muted mb-2">
          Inscrições pendentes
        </p>
        {pending.length === 0 ? (
          <EmptyState>Nenhuma inscrição aguardando resposta.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {pending.map((p) => (
              <ApplicantRow
                key={p.id}
                participant={p}
                busy={busy}
                actions={
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDecide(p.id, "approved")}
                      title="Aprovar"
                      aria-label={`Aprovar ${p.character.name}`}
                      className="text-moss p-1 hover:opacity-70 cursor-pointer disabled:opacity-40"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDecide(p.id, "rejected")}
                      title="Recusar"
                      aria-label={`Recusar ${p.character.name}`}
                      className="text-blood p-1 hover:opacity-70 cursor-pointer disabled:opacity-40"
                    >
                      <Ban size={18} />
                    </button>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mb-5">
        <p className="font-mono text-[10px] uppercase text-muted mb-2">
          Participantes confirmados
        </p>
        {approved.length === 0 ? (
          <EmptyState>Ninguém confirmado ainda.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {approved.map((p) => (
              <ApplicantRow
                key={p.id}
                participant={p}
                busy={busy}
                actions={
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDecide(p.id, "rejected")}
                    title="Remover da missão"
                    aria-label={`Remover ${p.character.name} da missão`}
                    className="text-blood p-1 hover:opacity-70 cursor-pointer disabled:opacity-40"
                  >
                    <UserMinus size={17} />
                  </button>
                }
              />
            ))}
          </ul>
        )}
      </section>

      {rejected.length > 0 && (
        <section>
          <p className="font-mono text-[10px] uppercase text-muted mb-2">
            Recusadas / canceladas
          </p>
          <ul className="space-y-1">
            {rejected.map((p) => (
              <li key={p.id} className="font-body text-[13px] text-muted">
                {p.character.name} ({p.player.username}) —{" "}
                {p.status === "rejected" ? "recusada" : "cancelada pelo jogador"}
              </li>
            ))}
          </ul>
        </section>
      )}

      {approved.length > 0 && approved.length < mission.min_players && (
        <p className="font-body text-[12px] text-blood mt-4">
          Abaixo do mínimo de {mission.min_players} jogador(es) — considere cancelar se a
          data se aproximar.
        </p>
      )}
    </Modal>
  );
}

function ApplicantRow({
  participant,
  actions,
}: {
  participant: ParticipantView;
  busy: boolean;
  actions: React.ReactNode;
}) {
  const c = participant.character;
  return (
    <li className="flex items-start justify-between gap-3 p-2.5 rounded-[2px] bg-panel-light border border-brass-dim/30">
      <div className="min-w-0">
        <p className="font-display font-bold text-ink-text text-[15px]">
          {c.name}{" "}
          <span className="font-body font-normal text-muted text-[13px]">
            ({participant.player.username})
          </span>
        </p>
        <p className="font-body text-[12.5px] text-muted">
          {c.class}
          {c.race ? ` · ${c.race}` : ""} · Nível {levelFromXp(c.xp)} · {c.reputation} REP ·{" "}
          {titleFromReputation(c.reputation)}
        </p>
        <p className="font-mono text-[11px] text-muted mt-0.5">
          PV {c.current_hp}/{c.max_hp} · CA {c.armor_class}
        </p>
        {c.roll20_url && (
          <a
            href={c.roll20_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 mt-1 font-mono text-[11px] text-brass-dim hover:underline"
          >
            <BookOpen size={11} aria-hidden /> Ficha no Roll20
          </a>
        )}
      </div>
      <div className="flex gap-1 shrink-0">{actions}</div>
    </li>
  );
}
