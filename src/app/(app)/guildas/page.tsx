"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useBoard } from "@/lib/data/board-provider";
import { createGuild, setCharacterGuild } from "@/lib/data/api";
import { titleFromReputation } from "@/lib/domain/rules";
import {
  BrassButton,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  SectionBar,
  SectionLabel,
} from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";

export default function GuildasPage() {
  const { data, loading, error, busy, refresh, run, myActiveCharacters } = useBoard();
  const [founding, setFounding] = useState(false);

  if (loading) return <LoadingState label="Reunindo as guildas..." />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  const ranked = [...data.guilds].sort((a, b) => b.reputation - a.reputation);
  const topAdventurers = [...data.characters]
    .filter((c) => c.active)
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 5);

  return (
    <div>
      <SectionBar caption={`${data.guilds.length} guilda(s) fundada(s)`}>
        <BrassButton onClick={() => setFounding(true)}>
          <Plus size={13} className="inline -mt-0.5 mr-1" aria-hidden />
          Nova guilda
        </BrassButton>
      </SectionBar>

      {data.guilds.length === 0 && (
        <EmptyState>Nenhuma guilda fundada ainda. Que tal começar a sua?</EmptyState>
      )}

      <div className="space-y-3">
        {ranked.map((g, idx) => (
          <div key={g.id} className="q-panel p-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-display font-bold text-ink-text text-[17px] break-words">
                #{idx + 1} {g.name}
              </h4>
              <span className="font-mono text-brass-dim text-[13px] shrink-0">
                {g.reputation} REP
              </span>
            </div>

            {g.motto && (
              <p className="font-body text-[13px] text-muted italic mt-1">
                &quot;{g.motto}&quot;
              </p>
            )}

            <p className="font-body text-xs text-muted mt-2">
              {g.members.length === 0
                ? "Sem membros ainda — entre pela carteirinha do seu personagem, no campo Guilda."
                : `Membros: ${g.members
                    .map((m) => `${m.characterName} (${m.playerName})`)
                    .join(", ")}`}
            </p>

            <MembershipControls guildId={g.id} />
          </div>
        ))}
      </div>

      {topAdventurers.length > 0 && (
        <>
          <SectionLabel>Aventureiros em destaque</SectionLabel>
          <div className="space-y-1.5">
            {topAdventurers.map((c, idx) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-[2px] bg-panel border border-brass-dim/35"
              >
                <span className="font-body text-[13px] text-ink-text min-w-0 truncate">
                  #{idx + 1} {c.name}{" "}
                  <span className="text-muted">({c.player.username})</span>
                </span>
                <span className="font-mono text-xs text-brass-dim shrink-0">
                  {c.reputation} REP · {titleFromReputation(c.reputation)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {founding && <FoundGuildModal onClose={() => setFounding(false)} />}
    </div>
  );

  /**
   * Entrar/sair da guilda direto pelo card, sem precisar abrir a carteirinha.
   * Uma ficha pertence a no máximo uma guilda — por isso é troca, não adição.
   */
  function MembershipControls({ guildId }: { guildId: string }) {
    if (myActiveCharacters.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-brass-dim/20">
        {myActiveCharacters.map((c) => {
          const inThis = c.guild_id === guildId;
          return (
            <BrassButton
              key={c.id}
              small
              variant={inThis ? "moss" : "ghost"}
              disabled={busy}
              onClick={() =>
                run(
                  () => setCharacterGuild(c.id, inThis ? null : guildId),
                  inThis
                    ? `${c.name} saiu da guilda.`
                    : `${c.name} entrou na guilda.`,
                )
              }
            >
              {inThis ? `Sair · ${c.name}` : `Entrar · ${c.name}`}
            </BrassButton>
          );
        })}
      </div>
    );
  }

  function FoundGuildModal({ onClose }: { onClose: () => void }) {
    const [name, setName] = useState("");
    const [motto, setMotto] = useState("");
    const valid = name.trim().length >= 2;

    const submit = async () => {
      const ok = await run(() => createGuild(name, motto), "Guilda fundada.");
      if (ok) onClose();
    };

    return (
      <Modal title="Nova Guilda" onClose={onClose}>
        <Field label="Nome da guilda">
          <input
            className="q-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Companhia do Leão Negro"
            maxLength={60}
            autoFocus
          />
        </Field>
        <Field label="Lema (opcional)">
          <input
            className="q-input"
            value={motto}
            onChange={(e) => setMotto(e.target.value)}
            placeholder="Ex: Nossa espada protege os fracos."
          />
        </Field>
        <p className="font-body text-[13px] text-muted italic mb-4">
          A reputação da guilda não é editável diretamente — ela é sempre a soma da
          reputação de todos os personagens que forem membros dela.
        </p>
        <div className="flex justify-end gap-2">
          <BrassButton variant="ghost" onClick={onClose}>
            Cancelar
          </BrassButton>
          <BrassButton disabled={!valid || busy} onClick={submit}>
            {busy ? "Fundando..." : "Fundar guilda"}
          </BrassButton>
        </div>
      </Modal>
    );
  }
}
