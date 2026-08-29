"use client";

import { useMemo } from "react";
import { useBoard } from "@/lib/data/board-provider";
import { playerTitles } from "@/lib/domain/achievements";
import { titleFromReputation } from "@/lib/domain/rules";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SectionLabel,
} from "@/components/ui/primitives";
import { AchievementIcon } from "@/components/ui/achievement-icon";

/**
 * Mural de Conquistas.
 *
 * Duas camadas, como no protótipo:
 * - TÍTULOS do jogador: derivados aqui, das missões mestradas/jogadas.
 * - TROFÉUS por ficha: vêm de `character_achievements`, gravados pela RPC de
 *   resolução. Nada é concedido manualmente em nenhum dos dois casos.
 */
export default function MuralPage() {
  const { profile, data, loading, error, refresh, myCharacters } = useBoard();

  const titles = useMemo(
    () => playerTitles(profile.id, data.characters, data.missions, data.achievements),
    [profile.id, data.characters, data.missions, data.achievements],
  );

  const catalog = useMemo(
    () => data.achievements.filter((a) => a.scope === "character"),
    [data.achievements],
  );

  if (loading) return <LoadingState label="Polindo os troféus..." />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <div>
      <section className="mb-6">
        <p className="font-mono text-[11px] uppercase text-faint-dim mb-2">
          Títulos de {profile.username}
        </p>
        {titles.length === 0 ? (
          <EmptyState>
            Nenhum título conquistado ainda — jogue ou mestre missões para começar seu
            mural.
          </EmptyState>
        ) : (
          <div className="flex flex-wrap gap-2">
            {titles.map((t) => (
              <div
                key={t.code}
                title={t.description}
                className="flex items-center gap-2 px-3 py-2 rounded-[2px] bg-panel border border-brass-dim/40"
              >
                <AchievementIcon name={t.icon} size={16} className="text-brass-dim" />
                <span className="font-display text-[13px] font-semibold text-ink-text">
                  {t.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="font-mono text-[11px] uppercase text-faint-dim mb-2">
        Troféus por ficha
      </p>
      {myCharacters.length === 0 ? (
        <EmptyState>
          Cadastre uma ficha em Minhas Fichas para começar a colecionar troféus.
        </EmptyState>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {myCharacters.map((c) => (
            <div key={c.id} className="q-panel p-4">
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <p className="font-display font-bold text-ink-text text-[15px] truncate">
                  {c.name}
                </p>
                <span className="font-mono text-[11px] text-brass-dim shrink-0">
                  {titleFromReputation(c.reputation)}
                </span>
              </div>

              {c.achievements.length === 0 ? (
                <p className="font-body text-xs text-muted italic">Sem troféus ainda.</p>
              ) : (
                <div className="space-y-1.5">
                  {c.achievements.map((ca) => (
                    <div
                      key={ca.id}
                      className="flex items-center gap-2"
                      title={ca.achievement.description}
                    >
                      <AchievementIcon
                        name={ca.achievement.icon}
                        className="text-brass-dim"
                      />
                      <span className="font-body text-[12.5px] text-ink-text">
                        {ca.achievement.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {catalog.length > 0 && (
        <>
          <SectionLabel>Troféus que existem para conquistar</SectionLabel>
          <div className="grid sm:grid-cols-2 gap-2">
            {catalog.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-2 px-3 py-2 rounded-[2px] border border-brass-dim/20 bg-panel/10"
              >
                <AchievementIcon
                  name={a.icon}
                  size={14}
                  className="text-faint-dim mt-0.5 shrink-0"
                />
                <div>
                  <p className="font-display text-[12.5px] font-semibold text-faint">
                    {a.name}
                  </p>
                  <p className="font-body text-[11.5px] text-faint-dim">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
