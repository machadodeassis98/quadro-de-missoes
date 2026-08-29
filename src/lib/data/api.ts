"use client";

/**
 * Camada de acesso a dados.
 *
 * TODA leitura e escrita do quadro passa por aqui — nenhum componente fala com
 * o Supabase diretamente. Isso mantém as queries num lugar só (fácil de auditar
 * e de otimizar) e deixa a UI declarativa.
 *
 * Escrita sensível (aprovar, resolver, inscrever) vai por RPC, não por UPDATE
 * direto: a validação mora no banco, dentro de uma transação.
 */

import { createClient } from "@/lib/supabase/client";
import { parseItemList } from "@/lib/domain/rules";
import type {
  Achievement,
  Character,
  CharacterAchievement,
  CharacterEvent,
  CharacterItem,
  CharacterView,
  Guild,
  GuildView,
  HistoryEntry,
  Mission,
  MissionParticipant,
  MissionReward,
  MissionView,
  ParticipantView,
  Profile,
} from "@/lib/types/database";

/* ------------------------------------------------------------------ */
/*  Erros                                                              */
/* ------------------------------------------------------------------ */

/**
 * Erro com mensagem já em português, pronta para a tela.
 * As RPCs levantam exceções com texto amigável ("Você já possui 3 fichas
 * ativas."); aqui só repassamos, traduzindo o que vier cru do Postgres.
 */
export class QuadroError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuadroError";
  }
}

interface PostgrestErrorLike {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
}

function toQuadroError(error: PostgrestErrorLike, fallback: string): QuadroError {
  const raw = error?.message ?? "";

  if (raw.includes("duplicate key") && raw.includes("one_per_user")) {
    return new QuadroError("Você já inscreveu outra ficha nesta missão.");
  }
  if (raw.includes("duplicate key") && raw.includes("unique_character")) {
    return new QuadroError("Esta ficha já está inscrita nesta missão.");
  }
  if (raw.includes("guilds_name_key")) {
    return new QuadroError("Já existe uma guilda com esse nome.");
  }
  if (raw.includes("profiles_username_key")) {
    return new QuadroError("Esse nome de jogador já está em uso.");
  }
  // Mensagens levantadas pelas nossas funções já vêm prontas.
  if (raw && !raw.startsWith("new row") && !raw.includes("violates")) {
    return new QuadroError(raw);
  }
  if (raw.includes("row-level security")) {
    return new QuadroError("Você não tem permissão para esta ação.");
  }
  return new QuadroError(fallback);
}

/* ------------------------------------------------------------------ */
/*  Normalização                                                       */
/* ------------------------------------------------------------------ */

/**
 * PostgREST devolve relação 1-para-1 ora como objeto, ora como array de um
 * item, dependendo de conseguir inferir a unicidade. Normaliza os dois casos.
 */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function many<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/* ------------------------------------------------------------------ */
/*  Formas cruas devolvidas pelas queries aninhadas                    */
/* ------------------------------------------------------------------ */

type RawParticipant = MissionParticipant & {
  character: Character | Character[] | null;
  player: Pick<Profile, "id" | "username"> | Pick<Profile, "id" | "username">[] | null;
  reward: MissionReward | MissionReward[] | null;
};

type RawMission = Mission & {
  dm: Pick<Profile, "id" | "username"> | Pick<Profile, "id" | "username">[] | null;
  participants: RawParticipant[] | null;
};

type RawCharacter = Character & {
  player: Pick<Profile, "id" | "username"> | Pick<Profile, "id" | "username">[] | null;
  items: CharacterItem[] | null;
  achievements:
    | (CharacterAchievement & { achievement: Achievement | Achievement[] | null })[]
    | null;
};

const UNKNOWN_PLAYER = { id: "", username: "—" };

function toParticipantView(raw: RawParticipant): ParticipantView | null {
  const character = one(raw.character);
  if (!character) return null;
  return {
    ...raw,
    character,
    player: one(raw.player) ?? UNKNOWN_PLAYER,
    reward: one(raw.reward),
  };
}

function toMissionView(raw: RawMission): MissionView {
  return {
    ...raw,
    dm: one(raw.dm) ?? UNKNOWN_PLAYER,
    participants: many(raw.participants)
      .map(toParticipantView)
      .filter((p): p is ParticipantView => p !== null),
  };
}

function toCharacterView(raw: RawCharacter): CharacterView {
  return {
    ...raw,
    player: one(raw.player) ?? UNKNOWN_PLAYER,
    items: many(raw.items),
    achievements: many(raw.achievements).flatMap((ca) => {
      const achievement = one(ca.achievement);
      return achievement ? [{ ...ca, achievement }] : [];
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  Selects                                                            */
/* ------------------------------------------------------------------ */

const MISSION_SELECT = `
  *,
  dm:profiles!missions_dm_id_fkey ( id, username ),
  participants:mission_participants (
    *,
    character:characters ( * ),
    player:profiles!mission_participants_user_id_fkey ( id, username ),
    reward:mission_rewards ( * )
  )
`;

const CHARACTER_SELECT = `
  *,
  player:profiles!characters_user_id_fkey ( id, username ),
  items:character_items ( * ),
  achievements:character_achievements ( *, achievement:achievements ( * ) )
`;

/* ------------------------------------------------------------------ */
/*  Carga inicial                                                      */
/* ------------------------------------------------------------------ */

export interface BoardData {
  characters: CharacterView[];
  missions: MissionView[];
  guilds: GuildView[];
  achievements: Achievement[];
}

/**
 * Carga do quadro inteiro em 5 queries paralelas.
 *
 * O grupo é pequeno (dezenas de fichas/missões), então buscar tudo de uma vez
 * é mais simples e mais rápido do que paginar — e é o que permite derivar
 * troféus, títulos e ranking sem ida e volta extra ao banco.
 */
export async function loadBoard(): Promise<BoardData> {
  const supabase = createClient();

  const [charactersRes, missionsRes, guildsRes, guildRepRes, achievementsRes] =
    await Promise.all([
      supabase.from("characters").select(CHARACTER_SELECT).order("created_at"),
      supabase.from("missions").select(MISSION_SELECT).order("scheduled_at", { ascending: false }),
      supabase.from("guilds").select("*, founder:profiles!guilds_founder_id_fkey ( id, username )"),
      supabase.from("guild_reputation").select("*"),
      supabase.from("achievements").select("*"),
    ]);

  const firstError =
    charactersRes.error ??
    missionsRes.error ??
    guildsRes.error ??
    guildRepRes.error ??
    achievementsRes.error;
  if (firstError) {
    throw toQuadroError(firstError, "Não foi possível carregar o quadro.");
  }

  const characters = ((charactersRes.data ?? []) as unknown as RawCharacter[]).map(
    toCharacterView,
  );
  const missions = ((missionsRes.data ?? []) as unknown as RawMission[]).map(toMissionView);

  const repByGuild = new Map(
    ((guildRepRes.data ?? []) as { guild_id: string; reputation: number }[]).map((r) => [
      r.guild_id,
      r.reputation,
    ]),
  );

  const guilds: GuildView[] = (
    (guildsRes.data ?? []) as unknown as (Guild & {
      founder: Pick<Profile, "id" | "username"> | Pick<Profile, "id" | "username">[] | null;
    })[]
  ).map((g) => {
    const members = characters
      .filter((c) => c.guild_id === g.id && c.active)
      .map((c) => ({
        characterId: c.id,
        characterName: c.name,
        playerName: c.player.username,
        reputation: c.reputation,
      }));
    return {
      ...g,
      founderName: one(g.founder)?.username ?? "—",
      // A reputação vem da view (soma no banco); o fallback recalcula local
      // caso a view ainda não tenha sido lida.
      reputation:
        repByGuild.get(g.id) ?? members.reduce((sum, m) => sum + m.reputation, 0),
      members,
    };
  });

  return {
    characters,
    missions,
    guilds,
    achievements: (achievementsRes.data ?? []) as Achievement[],
  };
}

/* ------------------------------------------------------------------ */
/*  Histórico de um personagem                                         */
/* ------------------------------------------------------------------ */

export async function loadCharacterHistory(characterId: string): Promise<HistoryEntry[]> {
  const supabase = createClient();

  const [eventsRes, itemsRes] = await Promise.all([
    supabase
      .from("character_events")
      .select("*, mission:missions ( title )")
      .eq("character_id", characterId)
      .order("created_at", { ascending: false }),
    supabase.from("character_items").select("*").eq("character_id", characterId),
  ]);

  if (eventsRes.error) {
    throw toQuadroError(eventsRes.error, "Não foi possível carregar o histórico.");
  }
  if (itemsRes.error) {
    throw toQuadroError(itemsRes.error, "Não foi possível carregar os itens.");
  }

  const items = (itemsRes.data ?? []) as CharacterItem[];

  return (
    (eventsRes.data ?? []) as unknown as (CharacterEvent & {
      mission: { title: string } | { title: string }[] | null;
    })[]
  ).map((event) => ({
    ...event,
    missionTitle: one(event.mission)?.title ?? null,
    items: event.mission_id
      ? items.filter((i) => i.mission_id === event.mission_id)
      : [],
  }));
}

/* ------------------------------------------------------------------ */
/*  Personagens                                                        */
/* ------------------------------------------------------------------ */

export interface NewCharacterInput {
  name: string;
  class: string;
  race: string;
}

export async function createCharacter(input: NewCharacterInput): Promise<Character> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new QuadroError("Sessão expirada. Entre novamente na taverna.");

  const { data, error } = await supabase
    .from("characters")
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      class: input.class,
      race: input.race,
    })
    .select()
    .single();

  if (error) throw toQuadroError(error, "Não foi possível cadastrar a ficha.");
  return data as Character;
}

/** Campos que o jogador pode editar na carteirinha. Progressão fica de fora. */
export interface CharacterSheetInput {
  name: string;
  class: string;
  race: string;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  current_hp: number;
  max_hp: number;
  armor_class: number;
  guild_id: string | null;
  roll20_url: string;
  notes: string;
  /** Lista separada por vírgula, como a carteirinha sempre editou. */
  itemsText: string;
}

export async function saveCharacterSheet(
  characterId: string,
  input: CharacterSheetInput,
  currentItems: CharacterItem[],
): Promise<void> {
  const supabase = createClient();
  const { itemsText, ...fields } = input;

  const { error } = await supabase
    .from("characters")
    .update({ ...fields, name: fields.name.trim() })
    .eq("id", characterId);

  if (error) throw toQuadroError(error, "Não foi possível salvar a ficha.");

  await syncCharacterItems(characterId, itemsText, currentItems);
}

/**
 * A carteirinha edita os itens como texto ("Poção, Adaga +1"). Aqui isso vira
 * linhas de `character_items`: some o que foi apagado, entra o que foi escrito.
 * Itens vindos de missão que continuam na lista não são tocados — assim o
 * `mission_id` (a origem, usada no histórico) se preserva.
 */
async function syncCharacterItems(
  characterId: string,
  itemsText: string,
  currentItems: CharacterItem[],
): Promise<void> {
  const supabase = createClient();
  const desired = parseItemList(itemsText);

  const remaining = [...currentItems];
  const toKeep: string[] = [];
  const toInsert: string[] = [];

  for (const name of desired) {
    const idx = remaining.findIndex(
      (i) => i.name.toLowerCase() === name.toLowerCase(),
    );
    if (idx >= 0) {
      toKeep.push(remaining[idx].id);
      remaining.splice(idx, 1);
    } else {
      toInsert.push(name);
    }
  }

  const toDelete = remaining.map((i) => i.id);

  if (toDelete.length > 0) {
    const { error } = await supabase.from("character_items").delete().in("id", toDelete);
    if (error) throw toQuadroError(error, "Não foi possível atualizar os itens.");
  }
  if (toInsert.length > 0) {
    const { error } = await supabase
      .from("character_items")
      .insert(toInsert.map((name) => ({ character_id: characterId, name })));
    if (error) throw toQuadroError(error, "Não foi possível atualizar os itens.");
  }
}

export async function setCharacterArchived(
  characterId: string,
  archived: boolean,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("characters")
    .update({ active: !archived })
    .eq("id", characterId);

  if (error) {
    throw toQuadroError(
      error,
      archived
        ? "Não foi possível arquivar a ficha."
        : "Não foi possível reativar a ficha.",
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Missões                                                            */
/* ------------------------------------------------------------------ */

export interface NewMissionInput {
  title: string;
  description: string;
  scheduled_at: string;
  min_level: number;
  max_level: number;
  max_players: number;
  min_players: number;
  rank: string;
  suggested_reward: string;
  suggested_classes: string[];
}

export async function createMission(input: NewMissionInput): Promise<Mission> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new QuadroError("Sessão expirada. Entre novamente na taverna.");

  const { data, error } = await supabase
    .from("missions")
    .insert({ ...input, title: input.title.trim(), dm_id: user.id })
    .select()
    .single();

  if (error) throw toQuadroError(error, "Não foi possível publicar a missão.");
  return data as Mission;
}

export async function applyToMission(
  missionId: string,
  characterId: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("apply_to_mission", {
    p_mission_id: missionId,
    p_character_id: characterId,
  });
  if (error) throw toQuadroError(error, "Não foi possível inscrever a ficha.");
}

export async function cancelParticipation(participantId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("cancel_participation", {
    p_participant_id: participantId,
  });
  if (error) throw toQuadroError(error, "Não foi possível cancelar a inscrição.");
}

export async function decideParticipation(
  participantId: string,
  decision: "approved" | "rejected" | "no_show",
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("decide_participation", {
    p_participant_id: participantId,
    p_decision: decision,
  });
  if (error) throw toQuadroError(error, "Não foi possível registrar a decisão.");
}

export async function setMissionStatus(
  missionId: string,
  status: "open" | "in_progress" | "cancelled",
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_mission_status", {
    p_mission_id: missionId,
    p_status: status,
  });
  if (error) throw toQuadroError(error, "Não foi possível atualizar a missão.");
}

export interface RewardInput {
  character_id: string;
  survived: boolean;
  xp: number;
  gold: number;
  reputation: number;
  items: string;
  notes: string;
}

/**
 * Resolve a missão numa transação só (RPC `resolve_mission`): recompensa,
 * XP/ouro/reputação, itens, histórico, participação e missão concluída,
 * conquistas. Ou tudo, ou nada.
 */
export async function resolveMission(
  missionId: string,
  rewards: RewardInput[],
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("resolve_mission", {
    p_mission_id: missionId,
    p_rewards: rewards,
  });
  if (error) throw toQuadroError(error, "Não foi possível resolver a missão.");
}

/* ------------------------------------------------------------------ */
/*  Guildas                                                            */
/* ------------------------------------------------------------------ */

export async function createGuild(name: string, motto: string): Promise<Guild> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new QuadroError("Sessão expirada. Entre novamente na taverna.");

  const { data, error } = await supabase
    .from("guilds")
    .insert({ name: name.trim(), motto: motto.trim(), founder_id: user.id })
    .select()
    .single();

  if (error) throw toQuadroError(error, "Não foi possível fundar a guilda.");
  return data as Guild;
}

/** Uma ficha pertence a no máximo uma guilda — por isso é um campo, não uma lista. */
export async function setCharacterGuild(
  characterId: string,
  guildId: string | null,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("characters")
    .update({ guild_id: guildId })
    .eq("id", characterId);
  if (error) throw toQuadroError(error, "Não foi possível atualizar a guilda da ficha.");
}
