import { describe, expect, it } from "vitest";
import { characterAchievementCodes, playerTitles } from "@/lib/domain/achievements";
import type {
  Achievement,
  CharacterView,
  MissionView,
  ParticipantView,
} from "@/lib/types/database";

/* ------------------------------------------------------------------ */
/*  Fábricas                                                           */
/* ------------------------------------------------------------------ */

const CATALOG: Achievement[] = [
  { code: "dm_first", name: "Mestre Novato", scope: "player" },
  { code: "dm_veteran", name: "Mestre Veterano", scope: "player" },
  { code: "grave_keeper", name: "Colecionador de Túmulos", scope: "player" },
  { code: "natural_born", name: "Sobrevivente Nato", scope: "player" },
  { code: "wanderer", name: "Andarilho", scope: "player" },
].map((a, i) => ({
  id: `ach-${i}`,
  code: a.code,
  name: a.name,
  description: `${a.name} — descrição`,
  icon: "trophy",
  scope: a.scope as Achievement["scope"],
  created_at: "2026-01-01T00:00:00Z",
}));

function character(overrides: Partial<CharacterView> = {}): CharacterView {
  return {
    id: "char-1",
    user_id: "player-1",
    name: "Arannis",
    class: "Guerreiro",
    race: "Humano",
    level: 1,
    xp: 0,
    gold: 0,
    reputation: 0,
    status: "alive",
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
    current_hp: 0, max_hp: 0, armor_class: 10,
    guild_id: null,
    roll20_url: "",
    notes: "",
    active: true,
    archived_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    player: { id: "player-1", username: "Noxxi" },
    items: [],
    achievements: [],
    ...overrides,
  };
}

function participant(
  characterId: string,
  status: ParticipantView["status"],
  survived: boolean | null = null,
): ParticipantView {
  return {
    id: `part-${characterId}-${Math.random()}`,
    mission_id: "m",
    character_id: characterId,
    user_id: "player-1",
    status,
    joined_at: "2026-01-01T00:00:00Z",
    approved_at: null,
    rejected_at: null,
    notes: "",
    character: character({ id: characterId }),
    player: { id: "player-1", username: "Noxxi" },
    reward:
      survived === null
        ? null
        : {
            id: "r",
            mission_participant_id: "p",
            xp: 100, gold: 50, reputation: 10,
            items: "", survived, notes: "",
            created_at: "2026-01-01T00:00:00Z",
          },
  };
}

function mission(overrides: Partial<MissionView> = {}): MissionView {
  return {
    id: `mission-${Math.random()}`,
    dm_id: "dm-1",
    title: "A Cripta Perdida",
    description: "",
    scheduled_at: "2026-08-28T18:01:00Z",
    min_level: 1, max_level: 4,
    max_players: 4, min_players: 2,
    rank: "D",
    suggested_reward: "",
    suggested_classes: [],
    status: "completed",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    dm: { id: "dm-1", username: "Sigmound" },
    participants: [],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */

describe("títulos do jogador (derivados)", () => {
  it("não dá título nenhum para quem acabou de chegar", () => {
    expect(playerTitles("player-1", [character()], [], CATALOG)).toEqual([]);
  });

  it("dá Mestre Novato depois da primeira missão mestrada", () => {
    const titles = playerTitles(
      "dm-1",
      [],
      [mission({ dm_id: "dm-1", status: "completed" })],
      CATALOG,
    );
    expect(titles.map((t) => t.code)).toContain("dm_first");
  });

  it("não conta missão mestrada que ainda não foi resolvida", () => {
    const titles = playerTitles(
      "dm-1",
      [],
      [mission({ dm_id: "dm-1", status: "open" })],
      CATALOG,
    );
    expect(titles).toEqual([]);
  });

  it("dá Colecionador de Túmulos com 2 fichas mortas", () => {
    const chars = [
      character({ id: "a", status: "dead" }),
      character({ id: "b", status: "dead" }),
    ];
    const titles = playerTitles("player-1", chars, [], CATALOG);
    expect(titles.map((t) => t.code)).toContain("grave_keeper");
  });

  it("dá Sobrevivente Nato só para ficha VIVA de nível 5+", () => {
    const alive = playerTitles(
      "player-1",
      [character({ level: 5, status: "alive" })],
      [],
      CATALOG,
    );
    expect(alive.map((t) => t.code)).toContain("natural_born");

    const dead = playerTitles(
      "player-1",
      [character({ level: 9, status: "dead" })],
      [],
      CATALOG,
    );
    expect(dead.map((t) => t.code)).not.toContain("natural_born");
  });

  it("dá Andarilho depois de jogar com 3 mestres diferentes", () => {
    const missions = ["dm-a", "dm-b", "dm-c"].map((dm) =>
      mission({
        dm_id: dm,
        status: "completed",
        participants: [participant("char-1", "completed", true)],
      }),
    );
    const titles = playerTitles("player-1", [character()], missions, CATALOG);
    expect(titles.map((t) => t.code)).toContain("wanderer");
  });

  it("não dá Andarilho com dois mestres só", () => {
    const missions = ["dm-a", "dm-b"].map((dm) =>
      mission({
        dm_id: dm,
        status: "completed",
        participants: [participant("char-1", "completed", true)],
      }),
    );
    const titles = playerTitles("player-1", [character()], missions, CATALOG);
    expect(titles.map((t) => t.code)).not.toContain("wanderer");
  });

  it("ignora código que não existe no catálogo", () => {
    const titles = playerTitles(
      "dm-1",
      [],
      [mission({ dm_id: "dm-1", status: "completed" })],
      [],
    );
    expect(titles).toEqual([]);
  });
});

describe("troféus da ficha (mesma regra da RPC)", () => {
  it("concede Primeira Missão ao concluir uma", () => {
    const m = mission({ participants: [participant("char-1", "completed", true)] });
    expect(characterAchievementCodes(character(), [m])).toContain("first_mission");
  });

  it("não concede nada por missão em que a ficha não concluiu", () => {
    const m = mission({ participants: [participant("char-1", "approved")] });
    expect(characterAchievementCodes(character(), [m])).toEqual([]);
  });

  it("concede Encarou a Morte ao sobreviver a um rank S", () => {
    const m = mission({
      rank: "S",
      participants: [participant("char-1", "completed", true)],
    });
    expect(characterAchievementCodes(character(), [m])).toContain("faced_death");
  });

  it("não concede Encarou a Morte a quem caiu no rank S", () => {
    const m = mission({
      rank: "S",
      participants: [participant("char-1", "completed", false)],
    });
    expect(characterAchievementCodes(character(), [m])).not.toContain("faced_death");
  });

  it("concede marcos de nível, XP e ouro", () => {
    const codes = characterAchievementCodes(
      character({ level: 10, xp: 64000, gold: 1500 }),
      [],
    );
    expect(codes).toContain("known_name");
    expect(codes).toContain("living_legend");
    expect(codes).toContain("xp_1000");
    expect(codes).toContain("gold_1000");
  });

  it("marca Caído em Combate para ficha morta", () => {
    expect(characterAchievementCodes(character({ status: "dead" }), [])).toContain(
      "fallen",
    );
  });

  it("concede Veterano de Estrada com 5 missões", () => {
    const missions = Array.from({ length: 5 }, () =>
      mission({ participants: [participant("char-1", "completed", true)] }),
    );
    const codes = characterAchievementCodes(character(), missions);
    expect(codes).toContain("road_veteran");
  });
});
