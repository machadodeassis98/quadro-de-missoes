"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useBoard } from "@/lib/data/board-provider";
import {
  createCharacter,
  saveCharacterSheet,
  setCharacterArchived,
  type CharacterSheetInput,
} from "@/lib/data/api";
import { MAX_ACTIVE_CHARACTERS, canCreateCharacter } from "@/lib/domain/rules";
import {
  BrassButton,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionBar,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/modal";
import { CharacterCard } from "@/components/characters/character-card";
import { CreateCharacterModal } from "@/components/characters/create-character-modal";
import { CharacterSheetModal } from "@/components/characters/character-sheet-modal";
import { HistoryModal } from "@/components/characters/history-modal";

export default function FichasPage() {
  const { data, loading, error, busy, refresh, run, myCharacters, myActiveCharacters } =
    useBoard();

  const [creating, setCreating] = useState(false);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);

  const sheetCharacter = myCharacters.find((c) => c.id === sheetId) ?? null;
  const historyCharacter = myCharacters.find((c) => c.id === historyId) ?? null;
  const archiveCharacter = myCharacters.find((c) => c.id === archiveId) ?? null;

  const atLimit = !canCreateCharacter(myActiveCharacters.length);

  const handleCreate = async (input: {
    name: string;
    class: string;
    race: string;
  }) => {
    const ok = await run(() => createCharacter(input), "Ficha cadastrada.");
    if (ok) setCreating(false);
  };

  const handleSave = async (input: CharacterSheetInput) => {
    if (!sheetCharacter) return;
    const ok = await run(
      () => saveCharacterSheet(sheetCharacter.id, input, sheetCharacter.items),
      "Ficha salva.",
    );
    if (ok) setSheetId(null);
  };

  const handleArchive = async () => {
    if (!archiveCharacter) return;
    const archiving = archiveCharacter.active;
    const ok = await run(
      () => setCharacterArchived(archiveCharacter.id, archiving),
      archiving ? "Ficha arquivada." : "Ficha reativada.",
    );
    if (ok) setArchiveId(null);
  };

  if (loading) return <LoadingState label="Abrindo suas fichas..." />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <div>
      <SectionBar
        caption={
          <>
            {myActiveCharacters.length}/{MAX_ACTIVE_CHARACTERS} fichas cadastradas
            {myCharacters.length > myActiveCharacters.length &&
              ` · ${myCharacters.length - myActiveCharacters.length} arquivada(s)`}
          </>
        }
      >
        <BrassButton
          disabled={atLimit}
          onClick={() => setCreating(true)}
          title={
            atLimit
              ? "Você já possui 3 fichas ativas. Arquive uma para liberar espaço."
              : undefined
          }
        >
          <Plus size={13} className="inline -mt-0.5 mr-1" aria-hidden />
          Nova ficha
        </BrassButton>
      </SectionBar>

      {atLimit && (
        <p className="font-body text-[13px] text-faint-dim italic mb-4">
          Você já possui {MAX_ACTIVE_CHARACTERS} fichas ativas. Arquive uma para liberar
          espaço — o histórico dela continua guardado.
        </p>
      )}

      {myCharacters.length === 0 && (
        <EmptyState>
          Você ainda não tem fichas. Cadastre até {MAX_ACTIVE_CHARACTERS} para começar a
          se inscrever em missões.
        </EmptyState>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {myCharacters.map((c) => (
          <CharacterCard
            key={c.id}
            character={c}
            onOpenSheet={() => setSheetId(c.id)}
            onOpenHistory={() => setHistoryId(c.id)}
            onToggleArchive={() => setArchiveId(c.id)}
          />
        ))}
      </div>

      {creating && (
        <CreateCharacterModal
          busy={busy}
          onClose={() => setCreating(false)}
          onCreate={handleCreate}
        />
      )}

      {sheetCharacter && (
        <CharacterSheetModal
          character={sheetCharacter}
          guilds={data.guilds}
          busy={busy}
          onClose={() => setSheetId(null)}
          onSave={handleSave}
        />
      )}

      {historyCharacter && (
        <HistoryModal character={historyCharacter} onClose={() => setHistoryId(null)} />
      )}

      {archiveCharacter && (
        <ConfirmDialog
          title={archiveCharacter.active ? "Arquivar ficha" : "Reativar ficha"}
          message={
            archiveCharacter.active
              ? `Arquivar ${archiveCharacter.name} libera uma das ${MAX_ACTIVE_CHARACTERS} vagas. O histórico, os itens e as conquistas continuam guardados, e a ficha pode voltar depois.`
              : `Reativar ${archiveCharacter.name} ocupa uma das ${MAX_ACTIVE_CHARACTERS} vagas ativas.`
          }
          confirmLabel={archiveCharacter.active ? "Arquivar" : "Reativar"}
          destructive={archiveCharacter.active}
          busy={busy}
          onConfirm={handleArchive}
          onClose={() => setArchiveId(null)}
        />
      )}
    </div>
  );
}
