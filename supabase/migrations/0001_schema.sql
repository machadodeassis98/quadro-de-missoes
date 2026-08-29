-- =====================================================================
-- 0001_schema.sql — Quadro de Missões
-- Tabelas, tipos, constraints, índices e views.
-- O banco inteiro pode ser recriado a partir das migrations desta pasta,
-- na ordem numérica.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------

-- Morte é permanente: uma ficha 'dead' nunca volta a se inscrever.
-- Isso é diferente de arquivamento (characters.active) — ver comentário lá.
create type character_status as enum ('alive', 'dead');

create type mission_status as enum ('open', 'full', 'in_progress', 'completed', 'cancelled');

create type participant_status as enum (
  'pending', 'approved', 'rejected', 'cancelled', 'completed', 'no_show'
);

-- Rank da missão (F a S). Carrega apenas uma SUGESTÃO de nível/XP/ouro/
-- reputação — o mestre define tudo manualmente, por jogador, ao resolver.
create type mission_rank as enum ('F', 'D', 'C', 'B', 'A', 'S');

create type achievement_scope as enum ('character', 'player');

create type character_event_type as enum (
  'character_created', 'mission_reward', 'mission_death', 'level_up', 'manual_adjustment'
);

-- ---------------------------------------------------------------------
-- profiles — 1:1 com auth.users
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique
                check (char_length(btrim(username)) between 2 and 24),
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil público do jogador. O username é o nome exibido no sistema.';

-- ---------------------------------------------------------------------
-- guilds
-- ---------------------------------------------------------------------
create table public.guilds (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(btrim(name)) between 2 and 60),
  motto       text not null default '',
  description text not null default '',
  founder_id  uuid not null references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now()
);

comment on table public.guilds is
  'A reputação da guilda NUNCA é armazenada — é sempre a soma da reputação dos '
  'membros. Ver a view guild_reputation.';

create index guilds_founder_id_idx on public.guilds (founder_id);

-- ---------------------------------------------------------------------
-- characters — a "carteirinha"
-- ---------------------------------------------------------------------
create table public.characters (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 40),
  class         text not null default '',
  race          text not null default '',

  -- Progressão: NUNCA escrita pelo cliente. Só a RPC resolve_mission escreve
  -- (ver trigger protect_character_progression em 0002).
  level         int not null default 1 check (level between 1 and 20),
  xp            int not null default 0 check (xp >= 0),
  gold          int not null default 0 check (gold >= 0),
  reputation    int not null default 0 check (reputation >= 0),
  status        character_status not null default 'alive',

  -- Atributos: números manuais soltos. Sem array padrão, sem bônus racial,
  -- sem derivação de classe — a ficha 5e completa vive no Roll20.
  strength      int not null default 10 check (strength between 1 and 30),
  dexterity     int not null default 10 check (dexterity between 1 and 30),
  constitution  int not null default 10 check (constitution between 1 and 30),
  intelligence  int not null default 10 check (intelligence between 1 and 30),
  wisdom        int not null default 10 check (wisdom between 1 and 30),
  charisma      int not null default 10 check (charisma between 1 and 30),

  current_hp    int not null default 0 check (current_hp >= 0),
  max_hp        int not null default 0 check (max_hp >= 0),
  armor_class   int not null default 10 check (armor_class between 0 and 40),

  guild_id      uuid references public.guilds (id) on delete set null,
  roll20_url    text not null default '',
  notes         text not null default '',

  -- Arquivamento: libera espaço nas 3 fichas ativas SEM apagar histórico.
  -- Nenhuma policy permite DELETE em characters — o histórico é permanente.
  active        boolean not null default true,
  archived_at   timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint characters_archived_consistency
    check ((active and archived_at is null) or (not active and archived_at is not null))
);

create index characters_user_id_idx on public.characters (user_id);
create index characters_guild_id_idx on public.characters (guild_id) where guild_id is not null;
create index characters_active_idx on public.characters (user_id) where active;

-- ---------------------------------------------------------------------
-- missions
-- ---------------------------------------------------------------------
create table public.missions (
  id                uuid primary key default gen_random_uuid(),
  dm_id             uuid not null references public.profiles (id) on delete cascade,
  title             text not null check (char_length(btrim(title)) between 1 and 120),
  description       text not null default '',
  scheduled_at      timestamptz not null,
  min_level         int not null default 1 check (min_level between 1 and 20),
  max_level         int not null default 20 check (max_level between 1 and 20),
  max_players       int not null default 4 check (max_players between 1 and 12),
  min_players       int not null default 1 check (min_players between 1 and 12),
  rank              mission_rank not null default 'F',
  suggested_reward  text not null default '',
  suggested_classes text[] not null default '{}',
  status            mission_status not null default 'open',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint missions_level_range check (max_level >= min_level),
  constraint missions_player_range check (max_players >= min_players)
);

comment on column public.missions.min_level is
  'Nível sugerido — indicativo. NUNCA bloqueia inscrição (regra validada com o grupo).';

create index missions_dm_id_idx on public.missions (dm_id);
create index missions_status_idx on public.missions (status);
create index missions_scheduled_at_idx on public.missions (scheduled_at desc);

-- ---------------------------------------------------------------------
-- mission_participants
-- ---------------------------------------------------------------------
create table public.mission_participants (
  id            uuid primary key default gen_random_uuid(),
  mission_id    uuid not null references public.missions (id) on delete cascade,
  character_id  uuid not null references public.characters (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  status        participant_status not null default 'pending',
  joined_at     timestamptz not null default now(),
  approved_at   timestamptz,
  rejected_at   timestamptz,
  notes         text not null default '',

  -- Uma ficha nunca tem duas inscrições na mesma missão. Reinscrição depois de
  -- cancelar reaproveita a linha (ver apply_to_mission em 0002).
  constraint mission_participants_unique_character unique (mission_id, character_id)
);

-- Um personagem por USUÁRIO por missão (preferência definida no escopo).
-- Parcial: cancelar/ser recusado libera o usuário para tentar com outra ficha.
create unique index mission_participants_one_per_user
  on public.mission_participants (mission_id, user_id)
  where status in ('pending', 'approved', 'completed', 'no_show');

create index mission_participants_mission_idx on public.mission_participants (mission_id);
create index mission_participants_character_idx on public.mission_participants (character_id);
create index mission_participants_user_idx on public.mission_participants (user_id);

-- ---------------------------------------------------------------------
-- mission_rewards — o que o mestre concedeu, por participante
-- ---------------------------------------------------------------------
create table public.mission_rewards (
  id                      uuid primary key default gen_random_uuid(),
  mission_participant_id  uuid not null unique
                            references public.mission_participants (id) on delete cascade,
  xp                      int not null default 0 check (xp >= 0),
  gold                    int not null default 0 check (gold >= 0),
  reputation              int not null default 0 check (reputation >= 0),
  items                   text not null default '',
  survived                boolean not null default true,
  notes                   text not null default '',
  created_at              timestamptz not null default now()
);

comment on table public.mission_rewards is
  'Escrito exclusivamente pela RPC resolve_mission. Nenhuma policy de INSERT/UPDATE '
  'para o cliente.';

-- ---------------------------------------------------------------------
-- character_items
-- ---------------------------------------------------------------------
create table public.character_items (
  id            uuid primary key default gen_random_uuid(),
  character_id  uuid not null references public.characters (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  quantity      int not null default 1 check (quantity > 0),
  description   text not null default '',
  -- De onde veio o item: null = anotado à mão pelo jogador na carteirinha.
  mission_id    uuid references public.missions (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index character_items_character_idx on public.character_items (character_id);

-- ---------------------------------------------------------------------
-- character_events — histórico permanente
-- ---------------------------------------------------------------------
create table public.character_events (
  id                 uuid primary key default gen_random_uuid(),
  character_id       uuid not null references public.characters (id) on delete cascade,
  mission_id         uuid references public.missions (id) on delete set null,
  event_type         character_event_type not null,
  xp_delta           int not null default 0,
  gold_delta         int not null default 0,
  reputation_delta   int not null default 0,
  description        text not null default '',
  created_at         timestamptz not null default now()
);

comment on table public.character_events is
  'Histórico de aventuras. Permanente: não é apagado ao arquivar a ficha. '
  'Escrito exclusivamente pelas RPCs.';

create index character_events_character_idx
  on public.character_events (character_id, created_at desc);

-- ---------------------------------------------------------------------
-- achievements + character_achievements
-- ---------------------------------------------------------------------
create table public.achievements (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null,
  description  text not null,
  icon         text not null default 'trophy',
  scope        achievement_scope not null default 'character',
  created_at   timestamptz not null default now()
);

comment on table public.achievements is
  'Catálogo. Conquistas de escopo "character" são concedidas pela RPC a partir do '
  'histórico; as de escopo "player" são derivadas na UI (títulos do jogador). '
  'Nunca há concessão manual.';

create table public.character_achievements (
  id              uuid primary key default gen_random_uuid(),
  character_id    uuid not null references public.characters (id) on delete cascade,
  achievement_id  uuid not null references public.achievements (id) on delete cascade,
  mission_id      uuid references public.missions (id) on delete set null,
  awarded_at      timestamptz not null default now(),
  constraint character_achievements_unique unique (character_id, achievement_id)
);

create index character_achievements_character_idx
  on public.character_achievements (character_id);

-- ---------------------------------------------------------------------
-- Views — a "separação conceitual" de guild_members sem permitir estado
-- inválido (uma ficha em duas guildas). security_invoker => a RLS das
-- tabelas-base continua valendo para quem consulta a view.
-- ---------------------------------------------------------------------
create view public.guild_members with (security_invoker = on) as
  select
    c.guild_id,
    c.id            as character_id,
    c.user_id,
    c.name          as character_name,
    c.class         as character_class,
    c.level,
    c.reputation,
    c.status,
    p.username      as player_name
  from public.characters c
  join public.profiles p on p.id = c.user_id
  where c.guild_id is not null
    and c.active;

create view public.guild_reputation with (security_invoker = on) as
  select
    g.id                                as guild_id,
    coalesce(sum(c.reputation), 0)::int as reputation,
    count(c.id)::int                    as member_count
  from public.guilds g
  left join public.characters c
    on c.guild_id = g.id and c.active
  group by g.id;
