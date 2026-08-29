"use client";

import { useState } from "react";
import { MISSION_RANKS, levelFromXp } from "@/lib/domain/rules";
import { Modal } from "@/components/ui/modal";
import { BrassButton, EmptyState, NumberBox } from "@/components/ui/primitives";
import type { RewardInput } from "@/lib/data/api";
import type { MissionView } from "@/lib/types/database";

interface Outcome {
  survived: boolean;
  xp: number;
  gold: number;
  reputation: number;
  items: string;
  notes: string;
}

/**
 * Resolver missão — o coração do sistema.
 *
 * Os campos vêm pré-preenchidos com a sugestão do rank, mas nada é automático:
 * o mestre ajusta XP, ouro, reputação, itens e observações de cada personagem,
 * individualmente. Quem cai não recebe nada e a ficha morre — morte é
 * permanente (3 falhas em salvaguarda de morte, sem volta).
 *
 * O envio vai inteiro para a RPC `resolve_mission`, numa transação: ou todos
 * recebem e o histórico é gravado, ou nada acontece.
 */
export function ResolveModal({
  mission,
  onClose,
  onResolve,
  busy,
}: {
  mission: MissionView;
  onClose: () => void;
  onResolve: (rewards: RewardInput[]) => void;
  busy: boolean;
}) {
  const approved = mission.participants.filter((p) => p.status === "approved");
  const rank = MISSION_RANKS[mission.rank];

  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>(() =>
    Object.fromEntries(
      approved.map((p) => [
        p.character_id,
        {
          survived: true,
          xp: rank.suggestedXp,
          gold: rank.suggestedGold,
          reputation: rank.suggestedReputation,
          items: "",
          notes: "",
        },
      ]),
    ),
  );

  const patch = (characterId: string, changes: Partial<Outcome>) =>
    setOutcomes((prev) => ({
      ...prev,
      [characterId]: { ...prev[characterId], ...changes },
    }));

  const submit = () => {
    const rewards: RewardInput[] = approved.map((p) => {
      const o = outcomes[p.character_id];
      return {
        character_id: p.character_id,
        survived: o.survived,
        xp: o.survived ? Math.max(0, o.xp) : 0,
        gold: o.survived ? Math.max(0, o.gold) : 0,
        reputation: o.survived ? Math.max(0, o.reputation) : 0,
        items: o.survived ? o.items : "",
        notes: o.notes,
      };
    });
    onResolve(rewards);
  };

  return (
    <Modal
      title="Resolver Missão"
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <BrassButton disabled={busy || approved.length === 0} onClick={submit}>
            {busy ? "Distribuindo..." : "Confirmar resultado e distribuir recompensas"}
          </BrassButton>
        </div>
      }
    >
      <p className="font-body text-[13px] text-muted mb-3">
        Marque quem sobreviveu e ajuste, individualmente, o XP, ouro, reputação e itens de
        cada personagem. Os valores já vêm pré-preenchidos como sugestão do rank{" "}
        {rank.label} da missão, mas nada aqui é automático: você pode mudar cada campo, de
        cada jogador, como quiser. Quem cai não recebe nada e a ficha fica com o status
        &quot;morto&quot; — sem volta.
      </p>

      {approved.length === 0 && (
        <EmptyState>
          Nenhum participante confirmado. Aprove as inscrições antes de resolver.
        </EmptyState>
      )}

      <div className="space-y-2.5">
        {approved.map((p) => {
          const o = outcomes[p.character_id];
          if (!o) return null;
          return (
            <div
              key={p.id}
              className="p-2.5 rounded-[2px] bg-panel-light border border-brass-dim/30"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-display text-ink-text text-sm">
                  {p.character.name}{" "}
                  <span className="font-body text-muted text-xs">
                    ({p.player.username} · nv. {levelFromXp(p.character.xp)})
                  </span>
                </span>
                <div className="flex gap-1.5">
                  <BrassButton
                    small
                    variant={o.survived ? "moss" : "ghost"}
                    onClick={() => patch(p.character_id, { survived: true })}
                  >
                    Sobreviveu
                  </BrassButton>
                  <BrassButton
                    small
                    variant={!o.survived ? "danger" : "ghost"}
                    onClick={() => patch(p.character_id, { survived: false })}
                  >
                    Caiu
                  </BrassButton>
                </div>
              </div>

              {o.survived ? (
                <div className="mt-2 space-y-1.5">
                  <RewardRow label="XP">
                    <NumberBox
                      value={o.xp}
                      width={80}
                      ariaLabel={`XP de ${p.character.name}`}
                      onChange={(v) => patch(p.character_id, { xp: v })}
                    />
                  </RewardRow>
                  <RewardRow label="Ouro">
                    <NumberBox
                      value={o.gold}
                      width={80}
                      ariaLabel={`Ouro de ${p.character.name}`}
                      onChange={(v) => patch(p.character_id, { gold: v })}
                    />
                  </RewardRow>
                  <RewardRow label="Reputação">
                    <NumberBox
                      value={o.reputation}
                      width={80}
                      ariaLabel={`Reputação de ${p.character.name}`}
                      onChange={(v) => patch(p.character_id, { reputation: v })}
                    />
                  </RewardRow>
                  <RewardRow label="Itens">
                    <input
                      className="q-input !py-[5px] !text-[13px]"
                      value={o.items}
                      onChange={(e) => patch(p.character_id, { items: e.target.value })}
                      placeholder="Ex: Poção de cura, Espada Longa +1"
                      aria-label={`Itens de ${p.character.name}`}
                    />
                  </RewardRow>
                  <RewardRow label="Obs.">
                    <input
                      className="q-input !py-[5px] !text-[13px]"
                      value={o.notes}
                      onChange={(e) => patch(p.character_id, { notes: e.target.value })}
                      placeholder="Anotação que fica no histórico deste personagem"
                      aria-label={`Observações sobre ${p.character.name}`}
                    />
                  </RewardRow>
                </div>
              ) : (
                <div className="mt-2">
                  <RewardRow label="Obs.">
                    <input
                      className="q-input !py-[5px] !text-[13px]"
                      value={o.notes}
                      onChange={(e) => patch(p.character_id, { notes: e.target.value })}
                      placeholder="Como caiu — fica registrado no histórico"
                      aria-label={`Observações sobre ${p.character.name}`}
                    />
                  </RewardRow>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function RewardRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[11px] text-muted w-[68px] shrink-0">{label}:</span>
      <div className="grow min-w-0">{children}</div>
    </div>
  );
}
