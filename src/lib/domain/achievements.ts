/**
 * Conquistas — derivadas do histórico, nunca digitadas.
 *
 * Divisão de responsabilidade:
 * - conquistas de FICHA (escopo "character") são calculadas e gravadas pelo
 *   banco, na RPC `resolve_mission`. A UI só lê `character_achievements`.
 * - TÍTULOS de JOGADOR (escopo "player") são derivados aqui, em tempo de
 *   render, a partir das missões e fichas já carregadas — como no protótipo.
 *   Não existe tabela de "player_achievements" justamente porque não há nada
 *   a persistir: o cálculo é determinístico a partir do histórico.
 */

import type { Achievement, CharacterView, MissionView } from "@/lib/types/database";

export interface DerivedTitle {
  code: string;
  name: string;
  description: string;
  icon: string;
}

/**
 * Títulos do jogador. `catalog` vem da tabela `achievements` (escopo player) e
 * fornece nome/descrição/ícone — assim os textos vivem num lugar só.
 */
export function playerTitles(
  playerId: string,
  characters: CharacterView[],
  missions: MissionView[],
  catalog: Achievement[],
): DerivedTitle[] {
  const byCode = new Map(catalog.map((a) => [a.code, a]));
  const mine = characters.filter((c) => c.user_id === playerId);
  const myCharacterIds = new Set(mine.map((c) => c.id));
  const codes: string[] = [];

  const mastered = missions.filter(
    (m) => m.dm_id === playerId && m.status === "completed",
  );
  if (mastered.length >= 1) codes.push("dm_first");
  if (mastered.length >= 10) codes.push("dm_veteran");

  const deadCount = mine.filter((c) => c.status === "dead").length;
  if (deadCount >= 2) codes.push("grave_keeper");

  if (mine.some((c) => c.level >= 5 && c.status === "alive")) {
    codes.push("natural_born");
  }

  const playedUnder = new Set(
    missions
      .filter(
        (m) =>
          m.status === "completed" &&
          m.participants.some(
            (p) => p.status === "completed" && myCharacterIds.has(p.character_id),
          ),
      )
      .map((m) => m.dm_id),
  );
  if (playedUnder.size >= 3) codes.push("wanderer");

  return codes.flatMap((code) => {
    const entry = byCode.get(code);
    if (!entry) return [];
    return [
      {
        code,
        name: entry.name,
        description: entry.description,
        icon: entry.icon,
      },
    ];
  });
}

/**
 * Prévia das conquistas de ficha que a próxima resolução concederia.
 * Usada só para exibir o que já foi conquistado quando o banco ainda não
 * respondeu — a fonte de verdade continua sendo `character_achievements`.
 */
export function characterAchievementCodes(
  character: CharacterView,
  missions: MissionView[],
): string[] {
  const completed = missions.filter((m) =>
    m.participants.some(
      (p) => p.character_id === character.id && p.status === "completed",
    ),
  );
  const codes: string[] = [];

  if (completed.length >= 1) codes.push("first_mission");
  if (completed.length >= 5) codes.push("road_veteran");

  const survivedRank = (rank: string) =>
    completed.some(
      (m) =>
        m.rank === rank &&
        m.participants.some(
          (p) => p.character_id === character.id && p.reward?.survived,
        ),
    );
  if (survivedRank("A")) codes.push("cold_blood");
  if (survivedRank("S")) codes.push("faced_death");

  const masters = new Set(completed.map((m) => m.dm_id));
  if (masters.size >= 3) codes.push("no_fixed_party");

  if (character.level >= 5) codes.push("known_name");
  if (character.level >= 10) codes.push("living_legend");
  if (character.xp >= 1000) codes.push("xp_1000");
  if (character.gold >= 1000) codes.push("gold_1000");
  if (character.status === "dead") codes.push("fallen");

  return codes;
}
