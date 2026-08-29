"use client";

import { useState } from "react";
import { BookOpen, Heart, ShieldHalf } from "lucide-react";
import {
  ABILITIES,
  CLASSES,
  RACES,
  abilityMod,
  formatMod,
  levelFromXp,
  titleFromReputation,
  type AbilityKey,
} from "@/lib/domain/rules";
import { Modal } from "@/components/ui/modal";
import { BrassButton, Field, NumberBox, StatReadout } from "@/components/ui/primitives";
import type { CharacterSheetInput } from "@/lib/data/api";
import type { CharacterView, GuildView } from "@/lib/types/database";

/**
 * A carteirinha editável.
 *
 * Regra preservada do protótipo: nível, XP, ouro e reputação aparecem, mas são
 * SÓ LEITURA — quem mexe neles é o mestre, ao resolver a missão. Aqui isso não
 * é mais só disciplina de UI: o trigger `protect_character_progression`
 * rejeita a alteração mesmo se alguém chamar a API direto.
 */
export function CharacterSheetModal({
  character,
  guilds,
  onClose,
  onSave,
  busy,
}: {
  character: CharacterView;
  guilds: GuildView[];
  onClose: () => void;
  onSave: (input: CharacterSheetInput) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<CharacterSheetInput>(() => ({
    name: character.name,
    class: character.class,
    race: character.race || RACES[RACES.length - 1],
    strength: character.strength,
    dexterity: character.dexterity,
    constitution: character.constitution,
    intelligence: character.intelligence,
    wisdom: character.wisdom,
    charisma: character.charisma,
    current_hp: character.current_hp,
    max_hp: character.max_hp,
    armor_class: character.armor_class,
    guild_id: character.guild_id,
    roll20_url: character.roll20_url,
    notes: character.notes,
    itemsText: character.items.map((i) => i.name).join(", "),
  }));

  const set = (patch: Partial<CharacterSheetInput>) =>
    setDraft((d) => ({ ...d, ...patch }));

  return (
    <Modal
      title={`Ficha de ${character.name}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <BrassButton variant="ghost" onClick={onClose}>
            Fechar sem salvar
          </BrassButton>
          <BrassButton
            disabled={busy || draft.name.trim().length === 0}
            onClick={() => onSave(draft)}
          >
            {busy ? "Salvando..." : "Salvar ficha"}
          </BrassButton>
        </div>
      }
    >
      <p className="font-body text-xs text-muted italic mb-3">
        Resumo de mesa. A ficha completa — perícias, salvaguardas, magias, talentos —
        fica no Roll20.
      </p>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          className="q-input flex-[1_1_140px]"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Nome"
          maxLength={40}
          aria-label="Nome do personagem"
        />
        <select
          className="q-input flex-[1_1_110px]"
          value={draft.class}
          onChange={(e) => set({ class: e.target.value })}
          aria-label="Classe"
        >
          {CLASSES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          className="q-input flex-[1_1_130px]"
          value={draft.race}
          onChange={(e) => set({ race: e.target.value })}
          aria-label="Raça"
        >
          {RACES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Progressão — creditada pelo mestre, nunca editável aqui */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-1.5">
        <StatReadout label="Nível" value={levelFromXp(character.xp)} />
        <StatReadout label="XP" value={character.xp} />
        <StatReadout label="Ouro" value={character.gold} />
        <StatReadout label="Reputação" value={character.reputation} />
      </div>
      <p className="font-body text-[11px] text-muted italic mb-4">
        Nível, XP, ouro e reputação são ajustados pelo mestre ao resolver as missões ·
        Título: {titleFromReputation(character.reputation)}
      </p>

      {/* Atributos — números manuais soltos, sem bônus racial (isso é do Roll20) */}
      <p className="font-mono text-[10px] uppercase text-muted mb-1.5">Atributos</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
        {ABILITIES.map((a) => {
          const score = draft[a.key as AbilityKey];
          return (
            <div
              key={a.key}
              className="text-center p-2 rounded-[2px] bg-panel-light border border-brass-dim/35"
            >
              <p className="font-mono text-[9.5px] uppercase text-muted mb-1">{a.label}</p>
              <NumberBox
                value={score}
                min={1}
                ariaLabel={a.label}
                onChange={(v) => set({ [a.key]: v } as Partial<CharacterSheetInput>)}
                width={48}
              />
              <p className="font-display font-bold text-brass-dim text-sm mt-1">
                {formatMod(abilityMod(score))}
              </p>
            </div>
          );
        })}
      </div>

      {/* PV / CA — referência rápida de mesa, manuais */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-2.5 rounded-[2px] text-center bg-panel-light border border-brass-dim/35">
          <Heart size={14} className="text-blood mx-auto" aria-hidden />
          <p className="font-mono text-[9.5px] uppercase text-muted mt-1">PV atual</p>
          <div className="mt-1 flex justify-center">
            <NumberBox
              value={draft.current_hp}
              ariaLabel="Pontos de vida atuais"
              onChange={(v) => set({ current_hp: v })}
            />
          </div>
        </div>
        <div className="p-2.5 rounded-[2px] text-center bg-panel-light border border-brass-dim/35">
          <Heart size={14} className="text-blood mx-auto" aria-hidden />
          <p className="font-mono text-[9.5px] uppercase text-muted mt-1">PV máx</p>
          <div className="mt-1 flex justify-center">
            <NumberBox
              value={draft.max_hp}
              ariaLabel="Pontos de vida máximos"
              onChange={(v) => set({ max_hp: v })}
            />
          </div>
        </div>
        <div className="p-2.5 rounded-[2px] text-center bg-panel-light border border-brass-dim/35">
          <ShieldHalf size={14} className="text-brass-dim mx-auto" aria-hidden />
          <p className="font-mono text-[9.5px] uppercase text-muted mt-1">CA</p>
          <div className="mt-1 flex justify-center">
            <NumberBox
              value={draft.armor_class}
              ariaLabel="Classe de armadura"
              onChange={(v) => set({ armor_class: v })}
            />
          </div>
        </div>
      </div>

      <Field label="Guilda">
        <select
          className="q-input"
          value={draft.guild_id ?? ""}
          onChange={(e) => set({ guild_id: e.target.value || null })}
        >
          <option value="">Nenhuma</option>
          {guilds.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Link da ficha no Roll20">
        <input
          className="q-input"
          value={draft.roll20_url}
          onChange={(e) => set({ roll20_url: e.target.value })}
          placeholder="https://app.roll20.net/..."
          inputMode="url"
        />
      </Field>
      {draft.roll20_url && (
        <a
          href={draft.roll20_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 mb-3 font-display text-xs font-semibold text-brass-dim hover:underline"
        >
          <BookOpen size={12} aria-hidden /> Abrir ficha completa no Roll20
        </a>
      )}

      <Field
        label="Itens (separados por vírgula)"
        hint="Itens ganhos em missão já aparecem aqui. Apagar da lista remove do inventário — o histórico da aventura continua registrado."
      >
        <textarea
          className="q-input min-h-[60px]"
          value={draft.itemsText}
          onChange={(e) => set({ itemsText: e.target.value })}
        />
      </Field>

      <Field label="Anotações">
        <textarea
          className="q-input min-h-[70px]"
          value={draft.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="Antecedente, alinhamento, personalidade, ganchos, lembretes de mesa..."
        />
      </Field>
    </Modal>
  );
}
