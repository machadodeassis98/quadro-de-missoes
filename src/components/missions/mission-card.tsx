"use client";

import {
  AlertTriangle, Ban, Calendar, Check, Clock, Coins, Gem, Play, Skull,
  Sparkles, Star, Users,
} from "lucide-react";
import { Seal } from "@/components/ui/seal";
import { BrassButton } from "@/components/ui/primitives";
import {
  MISSION_RANKS,
  acceptsApplications,
  formatLevelRange,
  formatMissionDate,
  formatMissionTime,
} from "@/lib/domain/rules";
import type { CharacterView, MissionView, ParticipantView } from "@/lib/types/database";

/**
 * O card do quadro. Composição preservada do protótipo: selo de rank à
 * esquerda, título em Cinzel, mestre embaixo, descrição, a fileira de
 * metadados em monoespaçada e a linha de sugestão do rank em itálico.
 */
export function MissionCard({
  mission,
  currentUserId,
  myCharacters,
  onApply,
  onCancelApplication,
  onDecide,
  onOpenPanel,
  onResolve,
  onStart,
  onCancelMission,
  busy,
}: {
  mission: MissionView;
  currentUserId: string;
  myCharacters: CharacterView[];
  onApply: () => void;
  onCancelApplication: (participantId: string) => void;
  onDecide: (participantId: string, decision: "approved" | "rejected") => void;
  onOpenPanel: () => void;
  onResolve: () => void;
  onStart: () => void;
  onCancelMission: () => void;
  busy: boolean;
}) {
  const rank = MISSION_RANKS[mission.rank];
  const isMaster = mission.dm_id === currentUserId;
  const cancelled = mission.status === "cancelled";
  const done = mission.status === "completed";

  const approved = mission.participants.filter((p) => p.status === "approved");
  const completed = mission.participants.filter((p) => p.status === "completed");
  const pending = mission.participants.filter((p) => p.status === "pending");
  const seats = done ? completed.length : approved.length;

  const myIds = new Set(myCharacters.map((c) => c.id));
  const mine =
    mission.participants.find(
      (p) => p.user_id === currentUserId && p.status !== "cancelled",
    ) ?? mission.participants.find((p) => myIds.has(p.character_id)) ?? null;

  return (
    <article
      className="q-panel p-4 relative shadow-[0_4px_14px_rgba(0,0,0,0.22)]"
      style={{
        background: cancelled ? "#DCCFAA" : undefined,
        opacity: cancelled ? 0.6 : 1,
      }}
    >
      <div className="flex items-start gap-3">
        <Seal rank={mission.rank} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-display font-bold text-ink-text text-[17px] break-words">
              {mission.title}
            </h4>
            {cancelled && (
              <span className="font-mono text-[10px] text-blood shrink-0">CANCELADA</span>
            )}
            {done && (
              <span className="font-mono text-[10px] text-moss shrink-0">CONCLUÍDA</span>
            )}
            {mission.status === "in_progress" && (
              <span className="font-mono text-[10px] text-brass-dim shrink-0">
                EM ANDAMENTO
              </span>
            )}
            {mission.status === "full" && (
              <span className="font-mono text-[10px] text-brass-dim shrink-0">
                VAGAS PREENCHIDAS
              </span>
            )}
          </div>
          <p className="font-body text-xs text-muted">Mestre: {mission.dm.username}</p>
        </div>
      </div>

      {mission.description && (
        <p className="font-body text-ink-text text-sm mt-2.5 whitespace-pre-line break-words">
          {mission.description}
        </p>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 font-mono text-[11.5px] text-muted">
        <span className="flex items-center gap-1">
          <Calendar size={12} aria-hidden /> {formatMissionDate(mission.scheduled_at)}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} aria-hidden /> {formatMissionTime(mission.scheduled_at)}
        </span>
        <span className="flex items-center gap-1">
          <Users size={12} aria-hidden /> {seats}/{mission.max_players} (mín.{" "}
          {mission.min_players})
        </span>
        <span className="flex items-center gap-1">
          <Star size={12} aria-hidden /> Nv.{" "}
          {formatLevelRange(mission.min_level, mission.max_level)}
        </span>
        <span className="flex items-center gap-1">
          <Sparkles size={12} aria-hidden /> Rank {rank.label}
        </span>
        {mission.suggested_reward && (
          <span className="flex items-center gap-1">
            <Gem size={12} aria-hidden /> {mission.suggested_reward} (sugestão)
          </span>
        )}
      </div>

      <p className="font-body text-[11px] text-muted italic mt-0.5">
        Sugestão do rank {rank.label}: {rank.suggestedXp} XP · {rank.suggestedGold} PO ·{" "}
        {rank.suggestedReputation} REP por sobrevivente — o mestre pode ajustar tudo, por
        jogador, ao resolver.
      </p>

      {mission.suggested_classes.length > 0 && (
        <p className="font-body text-xs text-muted italic mt-1.5">
          Sugerido: {mission.suggested_classes.join(", ")}
        </p>
      )}

      {/* -------------------- visão do mestre -------------------- */}
      {isMaster && !cancelled && !done && (
        <div className="mt-3 pt-3 border-t border-brass-dim/20">
          {pending.length > 0 && (
            <div className="mb-2">
              <p className="font-mono text-[10px] uppercase text-muted mb-1">
                Pedidos pendentes
              </p>
              {pending.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 py-1">
                  <span className="font-body text-[13px] text-ink-text min-w-0 truncate">
                    {p.character.name}{" "}
                    <span className="text-muted">
                      ({p.character.class}, {p.player.username})
                    </span>
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDecide(p.id, "approved")}
                      title="Aceitar"
                      aria-label={`Aceitar ${p.character.name}`}
                      className="text-moss p-1 hover:opacity-70 cursor-pointer disabled:opacity-40"
                    >
                      <Check size={17} />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDecide(p.id, "rejected")}
                      title="Recusar"
                      aria-label={`Recusar ${p.character.name}`}
                      className="text-blood p-1 hover:opacity-70 cursor-pointer disabled:opacity-40"
                    >
                      <Ban size={17} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {approved.length > 0 && (
            <p className="font-body text-xs text-moss mb-2">
              Confirmados: {approved.map((p) => p.character.name).join(", ")}
            </p>
          )}

          <div className="flex gap-2 flex-wrap">
            <BrassButton small variant="ghost" onClick={onOpenPanel}>
              Painel do mestre
            </BrassButton>
            {mission.status !== "in_progress" && approved.length > 0 && (
              <BrassButton small variant="ghost" onClick={onStart}>
                <Play size={11} className="inline -mt-0.5 mr-1" aria-hidden />
                Iniciar
              </BrassButton>
            )}
            {approved.length >= mission.min_players && (
              <BrassButton small onClick={onResolve}>
                Resolver missão
              </BrassButton>
            )}
            <BrassButton small variant="danger" onClick={onCancelMission}>
              Cancelar missão
            </BrassButton>
          </div>

          {approved.length > 0 && approved.length < mission.min_players && (
            <p className="flex items-center gap-1 font-body text-[11px] text-blood mt-1.5">
              <AlertTriangle size={12} aria-hidden /> Abaixo do mínimo — considere cancelar
              se a data se aproximar.
            </p>
          )}
        </div>
      )}

      {/* -------------------- visão do jogador -------------------- */}
      {!isMaster && (
        <div className="mt-3 pt-3 border-t border-brass-dim/20 flex items-center justify-between gap-3 flex-wrap">
          <PlayerStatus participant={mine} cancelled={cancelled} done={done} />

          {!mine && acceptsApplications(mission.status) && (
            <BrassButton small onClick={onApply} disabled={busy}>
              Inscrever ficha
            </BrassButton>
          )}
          {!mine && mission.status === "full" && (
            <span className="font-mono text-[11px] text-brass-dim">
              Não há mais vagas.
            </span>
          )}
          {mine?.status === "pending" && (
            <BrassButton
              small
              variant="ghost"
              disabled={busy}
              onClick={() => onCancelApplication(mine.id)}
            >
              Cancelar inscrição
            </BrassButton>
          )}
          {(mine?.status === "rejected" || mine?.status === "cancelled") &&
            acceptsApplications(mission.status) && (
              <BrassButton small onClick={onApply} disabled={busy}>
                Inscrever outra ficha
              </BrassButton>
            )}
        </div>
      )}

      {/* Resultado, depois de resolvida */}
      {done && mine?.reward && <MyResult participant={mine} />}
    </article>
  );
}

function PlayerStatus({
  participant,
  cancelled,
  done,
}: {
  participant: ParticipantView | null;
  cancelled: boolean;
  done: boolean;
}) {
  if (cancelled) {
    return (
      <span className="font-mono text-[11px] text-blood">
        Missão cancelada pelo mestre.
      </span>
    );
  }
  if (!participant) {
    return done ? (
      <span className="font-mono text-[11px] text-muted">
        Missão encerrada — você não participou.
      </span>
    ) : (
      <span />
    );
  }

  const map: Record<string, { text: string; className: string }> = {
    approved: { text: "✓ Confirmado nesta missão", className: "text-moss" },
    pending: { text: "Aguardando aprovação do mestre", className: "text-brass-dim" },
    rejected: { text: "Inscrição recusada", className: "text-blood" },
    cancelled: { text: "Inscrição cancelada", className: "text-muted" },
    completed: { text: "✓ Missão concluída", className: "text-moss" },
    no_show: { text: "Não compareceu", className: "text-muted" },
  };
  const entry = map[participant.status];
  return <span className={`font-mono text-[11px] ${entry.className}`}>{entry.text}</span>;
}

function MyResult({ participant }: { participant: ParticipantView }) {
  const reward = participant.reward;
  if (!reward) return null;

  return (
    <div className="mt-3 pt-3 border-t border-brass-dim/20">
      <p className="font-mono text-[10px] uppercase text-muted mb-1.5">
        Seu resultado — {participant.character.name}
      </p>
      {reward.survived ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12px]">
          <span className="text-ink-text">+{reward.xp} XP</span>
          <span className="flex items-center gap-1 text-brass-dim">
            <Coins size={12} aria-hidden />+{reward.gold} PO
          </span>
          <span className="flex items-center gap-1 text-muted">
            <Sparkles size={12} aria-hidden />+{reward.reputation} REP
          </span>
          {reward.items && (
            <span className="flex items-center gap-1 text-muted">
              <Gem size={12} aria-hidden />
              {reward.items}
            </span>
          )}
        </div>
      ) : (
        <p className="flex items-center gap-1.5 font-body text-[13px] text-blood">
          <Skull size={13} aria-hidden /> Sua ficha caiu nesta missão.
        </p>
      )}
      {reward.notes && (
        <p className="font-body text-[12.5px] text-muted italic mt-1">{reward.notes}</p>
      )}
    </div>
  );
}
