"use client";

import { useState } from "react";
import {
  CLASSES,
  MISSION_RANKS,
  MISSION_RANK_KEYS,
  combineDateTime,
  type MissionRank,
} from "@/lib/domain/rules";
import { Modal } from "@/components/ui/modal";
import { BrassButton, Field } from "@/components/ui/primitives";
import type { NewMissionInput } from "@/lib/data/api";

/**
 * Publicar missão. Quem publica vira o mestre daquela missão — não existe
 * conta permanentemente marcada como mestre.
 */
export function CreateMissionModal({
  onClose,
  onCreate,
  busy,
}: {
  onClose: () => void;
  onCreate: (input: NewMissionInput) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rank, setRank] = useState<MissionRank>("F");
  const [minLevel, setMinLevel] = useState(MISSION_RANKS.F.levelRange[0]);
  const [maxLevel, setMaxLevel] = useState(MISSION_RANKS.F.levelRange[1]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [minPlayers, setMinPlayers] = useState(2);
  const [suggestedReward, setSuggestedReward] = useState("");
  const [suggestedClasses, setSuggestedClasses] = useState<string[]>([]);

  const info = MISSION_RANKS[rank];
  const valid =
    title.trim().length > 0 && date !== "" && time !== "" && maxLevel >= minLevel &&
    maxPlayers >= minPlayers;

  const toggleClass = (c: string) =>
    setSuggestedClasses((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );

  /** Trocar o rank reposiciona a faixa de nível sugerida — mas ela segue editável. */
  const changeRank = (next: MissionRank) => {
    setRank(next);
    setMinLevel(MISSION_RANKS[next].levelRange[0]);
    setMaxLevel(MISSION_RANKS[next].levelRange[1]);
  };

  const submit = () => {
    if (!valid) return;
    onCreate({
      title: title.trim(),
      description: description.trim(),
      scheduled_at: combineDateTime(date, time),
      min_level: minLevel,
      max_level: maxLevel,
      max_players: maxPlayers,
      min_players: minPlayers,
      rank,
      suggested_reward: suggestedReward.trim(),
      suggested_classes: suggestedClasses,
    });
  };

  return (
    <Modal
      title="Publicar Missão"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <BrassButton variant="ghost" onClick={onClose}>
            Cancelar
          </BrassButton>
          <BrassButton disabled={!valid || busy} onClick={submit}>
            {busy ? "Publicando..." : "Publicar no quadro"}
          </BrassButton>
        </div>
      }
    >
      <Field label="Título">
        <input
          className="q-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Os Ecos da Mina Afundada"
          maxLength={120}
          autoFocus
        />
      </Field>

      <Field label="Descrição rápida">
        <textarea
          className="q-input min-h-[70px] resize-y"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="O que o grupo vai encontrar, gancho da aventura..."
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Rank da missão">
          <select
            className="q-input"
            value={rank}
            onChange={(e) => changeRank(e.target.value as MissionRank)}
          >
            {MISSION_RANK_KEYS.map((k) => (
              <option key={k} value={k}>
                Rank {k} — sugestão: {MISSION_RANKS[k].suggestedXp} XP /{" "}
                {MISSION_RANKS[k].suggestedGold} PO
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nível mín.">
            <input
              type="number"
              min={1}
              max={20}
              className="q-input"
              value={minLevel}
              onChange={(e) => setMinLevel(Number(e.target.value))}
            />
          </Field>
          <Field label="Nível máx.">
            <input
              type="number"
              min={1}
              max={20}
              className="q-input"
              value={maxLevel}
              onChange={(e) => setMaxLevel(Number(e.target.value))}
            />
          </Field>
        </div>
      </div>

      <p className="font-body text-[11px] text-muted italic -mt-1 mb-3">
        Sugestão do rank {info.label}: {info.suggestedXp} XP · {info.suggestedGold} PO ·{" "}
        {info.suggestedReputation} REP por sobrevivente. É só um ponto de partida — você
        define tudo, por jogador, ao resolver. O nível é indicativo e não bloqueia
        inscrição.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          <input
            type="date"
            className="q-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Horário">
          <input
            type="time"
            className="q-input"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Máximo de jogadores">
          <input
            type="number"
            min={1}
            max={12}
            className="q-input"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
          />
        </Field>
        <Field label="Mínimo p/ não cancelar">
          <input
            type="number"
            min={1}
            max={12}
            className="q-input"
            value={minPlayers}
            onChange={(e) => setMinPlayers(Number(e.target.value))}
          />
        </Field>
      </div>

      {maxPlayers < minPlayers && (
        <p className="font-body text-[12px] text-blood -mt-1 mb-3">
          O máximo de jogadores não pode ser menor que o mínimo.
        </p>
      )}

      <Field label="Recompensa sugerida — só informativo, mostrado no quadro">
        <input
          className="q-input"
          value={suggestedReward}
          onChange={(e) => setSuggestedReward(e.target.value)}
          placeholder="Ex: Poção de cura, Adaga +1 — você distribui de verdade ao resolver"
        />
      </Field>

      <Field label="Classes sugeridas (opcional)">
        <div className="flex flex-wrap gap-1.5">
          {CLASSES.map((c) => {
            const on = suggestedClasses.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => toggleClass(c)}
                className={[
                  "font-mono text-[11px] px-2 py-[3px] rounded-[2px] border border-brass-dim/50 cursor-pointer",
                  on ? "bg-brass text-ink" : "bg-transparent text-muted",
                ].join(" ")}
              >
                {c}
              </button>
            );
          })}
        </div>
      </Field>
    </Modal>
  );
}
