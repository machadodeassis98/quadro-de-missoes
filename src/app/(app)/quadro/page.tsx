"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useBoard } from "@/lib/data/board-provider";
import {
  applyToMission,
  cancelParticipation,
  createMission,
  decideParticipation,
  resolveMission,
  setMissionStatus,
  type NewMissionInput,
  type RewardInput,
} from "@/lib/data/api";
import { isMissionClosed } from "@/lib/domain/rules";
import {
  BrassButton,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionBar,
  SectionLabel,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/modal";
import { MissionCard } from "@/components/missions/mission-card";
import { CreateMissionModal } from "@/components/missions/create-mission-modal";
import { ApplyModal } from "@/components/missions/apply-modal";
import { MasterPanel } from "@/components/missions/master-panel";
import { ResolveModal } from "@/components/missions/resolve-modal";

export default function QuadroPage() {
  const { profile, missions, myActiveCharacters, loading, error, busy, refresh, run } =
    useBoard();

  const [publishing, setPublishing] = useState(false);
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [panelFor, setPanelFor] = useState<string | null>(null);
  const [resolvingFor, setResolvingFor] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const open = missions.filter((m) => !isMissionClosed(m.status));
  const closed = missions.filter((m) => isMissionClosed(m.status));

  const byId = (id: string | null) => missions.find((m) => m.id === id) ?? null;
  const applyMission = byId(applyingTo);
  const panelMission = byId(panelFor);
  const resolveMissionTarget = byId(resolvingFor);
  const cancelMission = byId(cancellingId);

  const handleCreate = async (input: NewMissionInput) => {
    const ok = await run(() => createMission(input), "Missão publicada.");
    if (ok) setPublishing(false);
  };

  const handleApply = async (characterId: string) => {
    if (!applyMission) return;
    const ok = await run(
      () => applyToMission(applyMission.id, characterId),
      "Inscrição enviada. Aguarde a aprovação do mestre.",
    );
    if (ok) setApplyingTo(null);
  };

  const handleDecide = (
    participantId: string,
    decision: "approved" | "rejected",
  ) =>
    run(
      () => decideParticipation(participantId, decision),
      decision === "approved" ? "Participante confirmado." : "Inscrição recusada.",
    );

  const handleResolve = async (rewards: RewardInput[]) => {
    if (!resolveMissionTarget) return;
    const ok = await run(
      () => resolveMission(resolveMissionTarget.id, rewards),
      "Recompensas salvas com sucesso.",
    );
    if (ok) {
      setResolvingFor(null);
      setPanelFor(null);
    }
  };

  const handleCancelMission = async () => {
    if (!cancelMission) return;
    const ok = await run(
      () => setMissionStatus(cancelMission.id, "cancelled"),
      "Missão cancelada.",
    );
    if (ok) setCancellingId(null);
  };

  if (loading) return <LoadingState label="Carregando missões..." />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  const cardProps = (missionId: string) => {
    const mission = missions.find((m) => m.id === missionId)!;
    return {
      mission,
      currentUserId: profile.id,
      myCharacters: myActiveCharacters,
      busy,
      onApply: () => setApplyingTo(mission.id),
      onCancelApplication: (participantId: string) =>
        run(() => cancelParticipation(participantId), "Inscrição cancelada."),
      onDecide: handleDecide,
      onOpenPanel: () => setPanelFor(mission.id),
      onResolve: () => setResolvingFor(mission.id),
      onStart: () =>
        run(() => setMissionStatus(mission.id, "in_progress"), "Missão iniciada."),
      onCancelMission: () => setCancellingId(mission.id),
    };
  };

  return (
    <div>
      <SectionBar caption={`${open.length} missão(ões) em aberto`}>
        <BrassButton onClick={() => setPublishing(true)}>
          <Plus size={13} className="inline -mt-0.5 mr-1" aria-hidden />
          Publicar missão
        </BrassButton>
      </SectionBar>

      {open.length === 0 && (
        <EmptyState>O quadro está vazio. Que tal ser o primeiro a mestrar?</EmptyState>
      )}

      <div className="space-y-3">
        {open.map((m) => (
          <MissionCard key={m.id} {...cardProps(m.id)} />
        ))}
      </div>

      {closed.length > 0 && (
        <>
          <SectionLabel>Histórico</SectionLabel>
          <div className="space-y-3">
            {closed.map((m) => (
              <MissionCard key={m.id} {...cardProps(m.id)} />
            ))}
          </div>
        </>
      )}

      {publishing && (
        <CreateMissionModal
          busy={busy}
          onClose={() => setPublishing(false)}
          onCreate={handleCreate}
        />
      )}

      {applyMission && (
        <ApplyModal
          mission={applyMission}
          characters={myActiveCharacters}
          busy={busy}
          onClose={() => setApplyingTo(null)}
          onApply={handleApply}
        />
      )}

      {panelMission && (
        <MasterPanel
          mission={panelMission}
          busy={busy}
          onClose={() => setPanelFor(null)}
          onDecide={handleDecide}
          onResolve={() => setResolvingFor(panelMission.id)}
        />
      )}

      {resolveMissionTarget && (
        <ResolveModal
          mission={resolveMissionTarget}
          busy={busy}
          onClose={() => setResolvingFor(null)}
          onResolve={handleResolve}
        />
      )}

      {cancelMission && (
        <ConfirmDialog
          title="Cancelar missão"
          message={`Cancelar "${cancelMission.title}" encerra as inscrições e a missão deixa de aceitar novos jogadores. A missão fica no histórico do quadro e não pode ser resolvida depois.`}
          confirmLabel="Cancelar missão"
          busy={busy}
          onConfirm={handleCancelMission}
          onClose={() => setCancellingId(null)}
        />
      )}
    </div>
  );
}
