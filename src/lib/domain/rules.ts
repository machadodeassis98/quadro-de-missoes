/**
 * Regras de negócio puras — sem React, sem Supabase, sem I/O.
 *
 * Tudo aqui é espelho do que o banco também garante (0002_functions.sql).
 * O frontend usa estas funções para *mostrar* o resultado antes do servidor
 * responder; o banco usa as dele para *garantir* o resultado. Se as duas
 * discordarem, a do banco é a que vale.
 */

/* ------------------------------------------------------------------ */
/*  Progressão                                                         */
/* ------------------------------------------------------------------ */

/** Tabela de XP por nível do D&D 5e (nível 1 a 20). */
export const LEVEL_TABLE = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
  120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
] as const;

export const MAX_LEVEL = 20;

/** Nível é sempre derivado do XP — nunca um valor digitado. */
export function levelFromXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  let level = 1;
  for (let i = 0; i < LEVEL_TABLE.length; i++) {
    if (safeXp >= LEVEL_TABLE[i]) level = i + 1;
  }
  return Math.min(level, MAX_LEVEL);
}

/** XP que falta para o próximo nível, ou null no nível 20. */
export function xpToNext(xp: number): number | null {
  const level = levelFromXp(xp);
  if (level >= MAX_LEVEL) return null;
  return LEVEL_TABLE[level] - Math.max(0, Math.floor(xp || 0));
}

/* ------------------------------------------------------------------ */
/*  Rank de missão                                                     */
/* ------------------------------------------------------------------ */

export type MissionRank = "F" | "D" | "C" | "B" | "A" | "S";

export interface RankInfo {
  label: MissionRank;
  levelRange: [number, number];
  suggestedXp: number;
  suggestedGold: number;
  suggestedReputation: number;
  /** Cor de preenchimento do selo. */
  color: string;
  /** Cor do brilho do selo (gradiente radial). */
  ring: string;
}

/**
 * Cada rank carrega uma SUGESTÃO. Ela pré-preenche o formulário de resolução,
 * mas o mestre altera livremente, por jogador. Rank nunca credita nada sozinho.
 */
export const MISSION_RANKS: Record<MissionRank, RankInfo> = {
  F: { label: "F", levelRange: [1, 2],   suggestedXp: 50,   suggestedGold: 25,   suggestedReputation: 10,  color: "#3F5D42", ring: "#5C8060" },
  D: { label: "D", levelRange: [3, 4],   suggestedXp: 150,  suggestedGold: 100,  suggestedReputation: 30,  color: "#3F5D42", ring: "#5C8060" },
  C: { label: "C", levelRange: [5, 7],   suggestedXp: 400,  suggestedGold: 300,  suggestedReputation: 75,  color: "#8C7327", ring: "#C9A227" },
  B: { label: "B", levelRange: [8, 10],  suggestedXp: 900,  suggestedGold: 750,  suggestedReputation: 150, color: "#7A4A22", ring: "#B0682F" },
  A: { label: "A", levelRange: [11, 15], suggestedXp: 2000, suggestedGold: 2000, suggestedReputation: 300, color: "#8C3A32", ring: "#B24A3F" },
  S: { label: "S", levelRange: [16, 20], suggestedXp: 5000, suggestedGold: 5000, suggestedReputation: 600, color: "#5B2A86", ring: "#8B4FC7" },
};

export const MISSION_RANK_KEYS: MissionRank[] = ["F", "D", "C", "B", "A", "S"];

export function rankInfo(rank: string | null | undefined): RankInfo {
  return MISSION_RANKS[(rank as MissionRank) ?? "F"] ?? MISSION_RANKS.F;
}

/* ------------------------------------------------------------------ */
/*  Reputação e título                                                 */
/* ------------------------------------------------------------------ */

/** O título é 100% derivado da faixa de reputação — nunca input manual. */
export function titleFromReputation(reputation: number | null | undefined): string {
  const rep = reputation ?? 0;
  if (rep >= 3000) return "Lenda da Guilda";
  if (rep >= 2000) return "Campeão";
  if (rep >= 1000) return "Veterano";
  if (rep >= 500) return "Aventureiro Renomado";
  if (rep >= 100) return "Aventureiro";
  return "Novato";
}

/* ------------------------------------------------------------------ */
/*  Atributos                                                          */
/* ------------------------------------------------------------------ */

export const ABILITIES = [
  { key: "strength", label: "Força" },
  { key: "dexterity", label: "Destreza" },
  { key: "constitution", label: "Constituição" },
  { key: "intelligence", label: "Inteligência" },
  { key: "wisdom", label: "Sabedoria" },
  { key: "charisma", label: "Carisma" },
] as const;

export type AbilityKey = (typeof ABILITIES)[number]["key"];

export function abilityMod(score: number | null | undefined): number {
  return Math.floor(((score ?? 10) - 10) / 2);
}

export function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/* ------------------------------------------------------------------ */
/*  Listas de referência                                               */
/* ------------------------------------------------------------------ */

export const CLASSES = [
  "Bárbaro", "Bardo", "Bruxo", "Clérigo", "Druida", "Feiticeiro",
  "Guerreiro", "Ladino", "Mago", "Monge", "Paladino", "Patrulheiro",
  "Caçador de Sangue", "Illrigger",
] as const;

/** Apenas rótulo — nenhum bônus automático (isso é responsabilidade do Roll20). */
export const RACES = [
  "Humano", "Elfo", "Anão", "Halfling", "Draconato", "Gnomo",
  "Meio-Elfo", "Meio-Orc", "Tiefling", "Outra / Personalizada",
] as const;

/* ------------------------------------------------------------------ */
/*  Limite de fichas                                                   */
/* ------------------------------------------------------------------ */

export const MAX_ACTIVE_CHARACTERS = 3;

export function canCreateCharacter(activeCount: number): boolean {
  return activeCount < MAX_ACTIVE_CHARACTERS;
}

/* ------------------------------------------------------------------ */
/*  Itens — a carteirinha edita como lista separada por vírgula        */
/* ------------------------------------------------------------------ */

export function parseItemList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/*  Estados                                                            */
/* ------------------------------------------------------------------ */

export type MissionStatus =
  | "open" | "full" | "in_progress" | "completed" | "cancelled";

export type ParticipantStatus =
  | "pending" | "approved" | "rejected" | "cancelled" | "completed" | "no_show";

export const MISSION_STATUS_LABEL: Record<MissionStatus, string> = {
  open: "Aberta",
  full: "Vagas preenchidas",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

export const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  pending: "Aguardando aprovação",
  approved: "Confirmado",
  rejected: "Inscrição recusada",
  cancelled: "Inscrição cancelada",
  completed: "Missão concluída",
  no_show: "Não compareceu",
};

/** Missão cancelada ou concluída não aceita mais inscrição. */
export function acceptsApplications(status: MissionStatus): boolean {
  return status === "open";
}

/** Missão concluída é somente leitura para jogadores. */
export function isMissionClosed(status: MissionStatus): boolean {
  return status === "completed" || status === "cancelled";
}

/* ------------------------------------------------------------------ */
/*  Formatação                                                         */
/* ------------------------------------------------------------------ */

/** Data/hora no formato que o quadro já usava: "2026-08-28" e "18:01". */
export function formatMissionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatMissionTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Combina os inputs `date` + `time` do formulário num ISO local. */
export function combineDateTime(date: string, time: string): string {
  return new Date(`${date}T${time || "00:00"}`).toISOString();
}

/** Faixa de nível como o quadro exibe: "3-4" ou "5" quando min = max. */
export function formatLevelRange(min: number, max: number): string {
  return min === max ? String(min) : `${min}-${max}`;
}
