"use client";

import { Archive, ArchiveRestore, BookOpen, Coins, Heart, History, ShieldHalf, Skull } from "lucide-react";
import { levelFromXp, titleFromReputation, xpToNext } from "@/lib/domain/rules";
import { BrassButton } from "@/components/ui/primitives";
import { AchievementIcon } from "@/components/ui/achievement-icon";
import type { CharacterView } from "@/lib/types/database";

/**
 * A carteirinha no grid de "Minhas Fichas". Porte direto do protótipo, mais
 * dois botões que não existiam: histórico e arquivar.
 */
export function CharacterCard({
  character,
  onOpenSheet,
  onOpenHistory,
  onToggleArchive,
}: {
  character: CharacterView;
  onOpenSheet: () => void;
  onOpenHistory: () => void;
  onToggleArchive: () => void;
}) {
  const dead = character.status === "dead";
  const archived = !character.active;
  const next = xpToNext(character.xp);
  const level = levelFromXp(character.xp);

  return (
    <div
      className="q-panel p-4 relative"
      style={{
        background: dead || archived ? "#DCCFAA" : undefined,
        opacity: archived ? 0.65 : dead ? 0.75 : 1,
      }}
    >
      {(dead || archived) && (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          {dead ? (
            <>
              <Skull size={16} className="text-blood" aria-hidden />
              <span className="font-mono text-[11px] text-blood">MORTO</span>
            </>
          ) : (
            <>
              <Archive size={14} className="text-muted" aria-hidden />
              <span className="font-mono text-[11px] text-muted">ARQUIVADA</span>
            </>
          )}
        </div>
      )}

      <div className="flex items-baseline justify-between gap-2 pr-20">
        <h4 className="font-display font-bold text-ink-text text-lg truncate">
          {character.name}
        </h4>
        <span className="font-mono text-brass-dim text-xs shrink-0">Nv. {level}</span>
      </div>

      <p className="font-body text-muted text-[13px] mb-2">
        {character.class}
        {character.race ? ` · ${character.race}` : ""}
      </p>

      <div className="flex items-center gap-3 text-xs mb-1 flex-wrap font-mono text-ink-text">
        <span>{character.xp} XP</span>
        {next !== null && !dead && (
          <span className="text-muted">
            · faltam {next} p/ nv. {level + 1}
          </span>
        )}
        <span className="flex items-center gap-1 text-brass-dim">
          <Coins size={12} aria-hidden />
          {character.gold}
        </span>
        <span className="flex items-center gap-1 text-blood">
          <Heart size={12} aria-hidden />
          {character.current_hp}/{character.max_hp}
        </span>
        <span className="flex items-center gap-1 text-muted">
          <ShieldHalf size={12} aria-hidden />
          {character.armor_class}
        </span>
      </div>

      <p className="font-mono text-[11px] text-muted mb-2">
        {character.reputation} REP · {titleFromReputation(character.reputation)}
      </p>

      {character.items.length > 0 && (
        <p className="font-body text-xs text-muted mb-2">
          Itens: {character.items.map((i) => i.name).join(", ")}
        </p>
      )}

      {character.roll20_url && (
        <a
          href={character.roll20_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 mb-2 font-mono text-[11px] text-brass-dim hover:underline"
        >
          <BookOpen size={11} aria-hidden /> Ficha no Roll20
        </a>
      )}

      {character.achievements.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1 mb-3">
          {character.achievements.map((ca) => (
            <span
              key={ca.id}
              title={ca.achievement.description}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] bg-brass/15 border border-brass-dim/35 font-mono text-[10px] text-brass-dim"
            >
              <AchievementIcon name={ca.achievement.icon} size={10} />
              {ca.achievement.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-1">
        <BrassButton small variant="ghost" onClick={onOpenSheet}>
          <BookOpen size={12} className="inline -mt-0.5 mr-1" aria-hidden />
          Ver carteirinha
        </BrassButton>
        <BrassButton small variant="ghost" onClick={onOpenHistory}>
          <History size={12} className="inline -mt-0.5 mr-1" aria-hidden />
          Histórico
        </BrassButton>
        <BrassButton
          small
          variant="ghost"
          onClick={onToggleArchive}
          title={
            archived
              ? "Trazer a ficha de volta para as 3 ativas"
              : "Guardar a ficha sem apagar o histórico"
          }
        >
          {archived ? (
            <>
              <ArchiveRestore size={12} className="inline -mt-0.5 mr-1" aria-hidden />
              Reativar
            </>
          ) : (
            <>
              <Archive size={12} className="inline -mt-0.5 mr-1" aria-hidden />
              Arquivar
            </>
          )}
        </BrassButton>
      </div>
    </div>
  );
}
