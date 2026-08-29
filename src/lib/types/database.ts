/**
 * Tipos das tabelas do Postgres.
 *
 * Escritos à mão a partir de `supabase/migrations/`. Quando o schema mudar,
 * mude aqui junto (ou regenere com
 * `npx supabase gen types typescript --project-id <ref> > src/lib/types/database.ts`).
 */

import type {
  MissionRank,
  MissionStatus,
  ParticipantStatus,
} from "@/lib/domain/rules";

export type CharacterStatus = "alive" | "dead";

export type CharacterEventType =
  | "character_created"
  | "mission_reward"
  | "mission_death"
  | "level_up"
  | "manual_adjustment";

export type AchievementScope = "character" | "player";

export interface Profile {
  id: string;
  username: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Character {
  id: string;
  user_id: string;
  name: string;
  class: string;
  race: string;
  level: number;
  xp: number;
  gold: number;
  reputation: number;
  status: CharacterStatus;
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
  active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Mission {
  id: string;
  dm_id: string;
  title: string;
  description: string;
  scheduled_at: string;
  min_level: number;
  max_level: number;
  max_players: number;
  min_players: number;
  rank: MissionRank;
  suggested_reward: string;
  suggested_classes: string[];
  status: MissionStatus;
  created_at: string;
  updated_at: string;
}

export interface MissionParticipant {
  id: string;
  mission_id: string;
  character_id: string;
  user_id: string;
  status: ParticipantStatus;
  joined_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  notes: string;
}

export interface MissionReward {
  id: string;
  mission_participant_id: string;
  xp: number;
  gold: number;
  reputation: number;
  items: string;
  survived: boolean;
  notes: string;
  created_at: string;
}

export interface CharacterItem {
  id: string;
  character_id: string;
  name: string;
  quantity: number;
  description: string;
  mission_id: string | null;
  created_at: string;
}

export interface CharacterEvent {
  id: string;
  character_id: string;
  mission_id: string | null;
  event_type: CharacterEventType;
  xp_delta: number;
  gold_delta: number;
  reputation_delta: number;
  description: string;
  created_at: string;
}

export interface Guild {
  id: string;
  name: string;
  motto: string;
  description: string;
  founder_id: string;
  created_at: string;
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  scope: AchievementScope;
  created_at: string;
}

export interface CharacterAchievement {
  id: string;
  character_id: string;
  achievement_id: string;
  mission_id: string | null;
  awarded_at: string;
}

/* ------------------------------------------------------------------ */
/*  Formas compostas usadas pela UI                                    */
/* ------------------------------------------------------------------ */

/** Inscrição + a ficha e o jogador por trás dela + a recompensa recebida. */
export interface ParticipantView extends MissionParticipant {
  character: Character;
  player: Pick<Profile, "id" | "username">;
  reward: MissionReward | null;
}

/** Missão pronta para o card do quadro. */
export interface MissionView extends Mission {
  dm: Pick<Profile, "id" | "username">;
  participants: ParticipantView[];
}

/** Ficha com o que a carteirinha e o histórico precisam. */
export interface CharacterView extends Character {
  player: Pick<Profile, "id" | "username">;
  items: CharacterItem[];
  achievements: (CharacterAchievement & { achievement: Achievement })[];
}

/** Uma linha do histórico de aventuras. */
export interface HistoryEntry extends CharacterEvent {
  missionTitle: string | null;
  items: CharacterItem[];
}

/** Guilda com a reputação derivada (soma dos membros). */
export interface GuildView extends Guild {
  founderName: string;
  reputation: number;
  members: {
    characterId: string;
    characterName: string;
    playerName: string;
    reputation: number;
  }[];
}
