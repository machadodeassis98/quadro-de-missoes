-- =====================================================================
-- 0002_functions.sql — regras de negócio no banco
--
-- Princípio: nenhuma regra importante mora só no frontend. Tudo o que o
-- produto promete (limite de 3 fichas, XP só via mestre, lotação, quem pode
-- aprovar/resolver) é reforçado aqui, em trigger ou em função RPC.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabela de nível 5e. Nível é 100% derivado do XP — nunca input manual.
-- ---------------------------------------------------------------------
create or replace function public.level_from_xp(p_xp int)
returns int
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select max(lvl)
      from (
        values
          (1, 0), (2, 300), (3, 900), (4, 2700), (5, 6500),
          (6, 14000), (7, 23000), (8, 34000), (9, 48000), (10, 64000),
          (11, 85000), (12, 100000), (13, 120000), (14, 140000), (15, 165000),
          (16, 195000), (17, 225000), (18, 265000), (19, 305000), (20, 355000)
      ) as t(lvl, threshold)
      where greatest(coalesce(p_xp, 0), 0) >= t.threshold
    ),
    1
  );
$$;

-- Título do personagem: derivado da faixa de reputação, nunca input manual.
create or replace function public.title_from_reputation(p_reputation int)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when coalesce(p_reputation, 0) >= 3000 then 'Lenda da Guilda'
    when coalesce(p_reputation, 0) >= 2000 then 'Campeão'
    when coalesce(p_reputation, 0) >= 1000 then 'Veterano'
    when coalesce(p_reputation, 0) >= 500  then 'Aventureiro Renomado'
    when coalesce(p_reputation, 0) >= 100  then 'Aventureiro'
    else 'Novato'
  end;
$$;

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace trigger characters_set_updated_at
  before update on public.characters
  for each row execute function public.set_updated_at();

create or replace trigger missions_set_updated_at
  before update on public.missions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Criação de perfil no cadastro. O username vem do metadata do signup;
-- se colidir, recebe um sufixo numérico em vez de quebrar o cadastro.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base     text;
  v_username text;
  v_suffix   int := 0;
begin
  v_base := btrim(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  if char_length(v_base) < 2 then
    v_base := 'aventureiro';
  end if;
  v_base := left(v_base, 24);
  v_username := v_base;

  while exists (select 1 from public.profiles where username = v_username) loop
    v_suffix := v_suffix + 1;
    v_username := left(v_base, 20) || v_suffix::text;
  end loop;

  insert into public.profiles (id, username, email)
  values (new.id, v_username, new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Limite de 3 fichas ATIVAS por jogador.
-- Arquivar libera espaço; desarquivar precisa ter espaço.
-- ---------------------------------------------------------------------
create or replace function public.enforce_character_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_active int;
begin
  if not new.active then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.active then
    return new;  -- já contava; nada mudou no total
  end if;

  select count(*) into v_active
  from public.characters
  where user_id = new.user_id
    and active
    and id <> new.id;

  if v_active >= 3 then
    raise exception 'Você já possui 3 fichas ativas.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace trigger characters_enforce_limit
  before insert or update on public.characters
  for each row execute function public.enforce_character_limit();

-- Arquivar/desarquivar mantém archived_at coerente sem o cliente precisar acertar.
create or replace function public.sync_character_archive()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.active then
    new.archived_at := null;
  elsif new.archived_at is null then
    new.archived_at := now();
  end if;
  return new;
end;
$$;

create or replace trigger characters_sync_archive
  before insert or update on public.characters
  for each row execute function public.sync_character_archive();

-- ---------------------------------------------------------------------
-- Progressão é intocável pelo cliente.
--
-- XP, ouro, reputação, nível e status (vivo/morto) só mudam dentro das RPCs,
-- que sinalizam a intenção com app.progression_write. Um UPDATE vindo do
-- navegador — mesmo do dono da ficha, mesmo com a policy de UPDATE liberada —
-- é rejeitado aqui.
-- ---------------------------------------------------------------------
create or replace function public.protect_character_progression()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('app.progression_write', true), 'off') = 'on' then
    return new;
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'A ficha não pode trocar de dono.' using errcode = 'check_violation';
  end if;

  if new.xp is distinct from old.xp
     or new.gold is distinct from old.gold
     or new.reputation is distinct from old.reputation
     or new.level is distinct from old.level
     or new.status is distinct from old.status then
    raise exception
      'XP, ouro, reputação, nível e status só são alterados pelo mestre ao resolver uma missão.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace trigger characters_protect_progression
  before update on public.characters
  for each row execute function public.protect_character_progression();

-- Evento de criação da ficha, para o histórico começar do dia zero.
create or replace function public.log_character_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.character_events (character_id, event_type, description)
  values (new.id, 'character_created', 'Ficha registrada na guilda.');
  return new;
end;
$$;

create or replace trigger characters_log_created
  after insert on public.characters
  for each row execute function public.log_character_created();

-- ---------------------------------------------------------------------
-- Inscrições — validação estrutural (vale para qualquer caminho de escrita)
-- ---------------------------------------------------------------------
create or replace function public.validate_participation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_char    public.characters%rowtype;
  v_mission public.missions%rowtype;
  v_approved int;
begin
  select * into v_char from public.characters where id = new.character_id;
  if not found then
    raise exception 'Ficha não encontrada.' using errcode = 'foreign_key_violation';
  end if;

  if v_char.user_id is distinct from new.user_id then
    raise exception 'A inscrição precisa ser feita pelo dono da ficha.'
      using errcode = 'check_violation';
  end if;

  select * into v_mission from public.missions where id = new.mission_id;
  if not found then
    raise exception 'Missão não encontrada.' using errcode = 'foreign_key_violation';
  end if;

  -- Entrar (ou voltar) para a fila só vale em missão aberta.
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    if v_mission.status = 'cancelled' then
      raise exception 'Esta missão foi cancelada e não aceita novas inscrições.'
        using errcode = 'check_violation';
    end if;
    if v_mission.status <> 'open' then
      raise exception 'Esta missão não está mais aberta para inscrições.'
        using errcode = 'check_violation';
    end if;
    if v_char.status = 'dead' then
      raise exception 'Esta ficha caiu em missão e não pode mais se inscrever.'
        using errcode = 'check_violation';
    end if;
    if not v_char.active then
      raise exception 'Esta ficha está arquivada.' using errcode = 'check_violation';
    end if;
  end if;

  -- Lotação, na aprovação.
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    select count(*) into v_approved
    from public.mission_participants
    where mission_id = new.mission_id
      and status = 'approved'
      and id <> new.id;

    if v_approved >= v_mission.max_players then
      raise exception 'Não há mais vagas nesta missão.' using errcode = 'check_violation';
    end if;

    new.approved_at := coalesce(new.approved_at, now());
  end if;

  if new.status = 'rejected' and (tg_op = 'INSERT' or old.status is distinct from 'rejected') then
    new.rejected_at := coalesce(new.rejected_at, now());
  end if;

  return new;
end;
$$;

create or replace trigger mission_participants_validate
  before insert or update on public.mission_participants
  for each row execute function public.validate_participation();

-- open <-> full conforme as vagas enchem/esvaziam.
create or replace function public.sync_mission_capacity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mission_id uuid := coalesce(new.mission_id, old.mission_id);
  v_mission    public.missions%rowtype;
  v_approved   int;
begin
  select * into v_mission from public.missions where id = v_mission_id;
  if not found then
    return coalesce(new, old);
  end if;

  select count(*) into v_approved
  from public.mission_participants
  where mission_id = v_mission_id and status = 'approved';

  if v_approved >= v_mission.max_players and v_mission.status = 'open' then
    update public.missions set status = 'full' where id = v_mission_id;
  elsif v_approved < v_mission.max_players and v_mission.status = 'full' then
    update public.missions set status = 'open' where id = v_mission_id;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace trigger mission_participants_sync_capacity
  after insert or update or delete on public.mission_participants
  for each row execute function public.sync_mission_capacity();

-- ---------------------------------------------------------------------
-- RPC: inscrever ficha numa missão
-- ---------------------------------------------------------------------
create or replace function public.apply_to_mission(
  p_mission_id   uuid,
  p_character_id uuid
)
returns public.mission_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_char   public.characters%rowtype;
  v_row    public.mission_participants%rowtype;
begin
  if v_uid is null then
    raise exception 'Você precisa estar autenticado.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_char from public.characters where id = p_character_id;
  if not found or v_char.user_id <> v_uid then
    raise exception 'Esta ficha não é sua.' using errcode = 'insufficient_privilege';
  end if;

  if exists (
    select 1 from public.missions where id = p_mission_id and dm_id = v_uid
  ) then
    raise exception 'Você é o mestre desta missão e não pode se inscrever nela.'
      using errcode = 'check_violation';
  end if;

  -- Uma ficha por usuário por missão.
  if exists (
    select 1
    from public.mission_participants
    where mission_id = p_mission_id
      and user_id = v_uid
      and character_id <> p_character_id
      and status in ('pending', 'approved', 'completed', 'no_show')
  ) then
    raise exception 'Você já inscreveu outra ficha nesta missão.'
      using errcode = 'unique_violation';
  end if;

  if exists (
    select 1
    from public.mission_participants
    where mission_id = p_mission_id
      and character_id = p_character_id
      and status in ('pending', 'approved', 'completed', 'no_show')
  ) then
    raise exception 'Esta ficha já está inscrita nesta missão.'
      using errcode = 'unique_violation';
  end if;

  -- Reinscrição depois de cancelar/ser recusado reaproveita a linha existente.
  insert into public.mission_participants (mission_id, character_id, user_id, status)
  values (p_mission_id, p_character_id, v_uid, 'pending')
  on conflict (mission_id, character_id) do update
    set status      = 'pending',
        joined_at   = now(),
        approved_at = null,
        rejected_at = null
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: jogador cancela a própria inscrição
-- ---------------------------------------------------------------------
create or replace function public.cancel_participation(p_participant_id uuid)
returns public.mission_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.mission_participants%rowtype;
begin
  if v_uid is null then
    raise exception 'Você precisa estar autenticado.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_row from public.mission_participants where id = p_participant_id;
  if not found or v_row.user_id <> v_uid then
    raise exception 'Esta inscrição não é sua.' using errcode = 'insufficient_privilege';
  end if;

  if v_row.status = 'completed' then
    raise exception 'Esta missão já foi resolvida.' using errcode = 'check_violation';
  end if;

  update public.mission_participants
  set status = 'cancelled'
  where id = p_participant_id
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: mestre aprova / recusa / remove participante
-- ---------------------------------------------------------------------
create or replace function public.decide_participation(
  p_participant_id uuid,
  p_decision       text
)
returns public.mission_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_row     public.mission_participants%rowtype;
  v_mission public.missions%rowtype;
begin
  if v_uid is null then
    raise exception 'Você precisa estar autenticado.' using errcode = 'insufficient_privilege';
  end if;

  if p_decision not in ('approved', 'rejected', 'no_show') then
    raise exception 'Decisão inválida.' using errcode = 'check_violation';
  end if;

  select * into v_row from public.mission_participants where id = p_participant_id;
  if not found then
    raise exception 'Inscrição não encontrada.' using errcode = 'no_data_found';
  end if;

  select * into v_mission from public.missions where id = v_row.mission_id;
  if v_mission.dm_id <> v_uid then
    raise exception 'Apenas o mestre desta missão pode decidir as inscrições.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_mission.status in ('completed', 'cancelled') then
    raise exception 'Esta missão já foi encerrada.' using errcode = 'check_violation';
  end if;

  update public.mission_participants
  set status = p_decision::participant_status
  where id = p_participant_id
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: mestre muda o estado da missão (iniciar / cancelar / reabrir)
-- ---------------------------------------------------------------------
create or replace function public.set_mission_status(
  p_mission_id uuid,
  p_status     text
)
returns public.missions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_mission public.missions%rowtype;
begin
  if v_uid is null then
    raise exception 'Você precisa estar autenticado.' using errcode = 'insufficient_privilege';
  end if;

  if p_status not in ('open', 'in_progress', 'cancelled') then
    raise exception 'Estado inválido. "completed" só é atingido resolvendo a missão.'
      using errcode = 'check_violation';
  end if;

  select * into v_mission from public.missions where id = p_mission_id for update;
  if not found then
    raise exception 'Missão não encontrada.' using errcode = 'no_data_found';
  end if;
  if v_mission.dm_id <> v_uid then
    raise exception 'Apenas o mestre pode administrar esta missão.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_mission.status = 'completed' then
    raise exception 'Uma missão concluída não muda mais de estado.'
      using errcode = 'check_violation';
  end if;

  update public.missions
  set status = p_status::mission_status
  where id = p_mission_id
  returning * into v_mission;

  return v_mission;
end;
$$;

-- ---------------------------------------------------------------------
-- Conquistas — derivadas do histórico, concedidas só por aqui.
-- ---------------------------------------------------------------------
create or replace function public.award_character_achievements(p_character_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_char       public.characters%rowtype;
  v_completed  int;
  v_masters    int;
  v_survived_a boolean;
  v_survived_s boolean;
  v_codes      text[] := '{}';
begin
  select * into v_char from public.characters where id = p_character_id;
  if not found then
    return;
  end if;

  select count(*) into v_completed
  from public.mission_participants mp
  where mp.character_id = p_character_id and mp.status = 'completed';

  select count(distinct m.dm_id) into v_masters
  from public.mission_participants mp
  join public.missions m on m.id = mp.mission_id
  where mp.character_id = p_character_id and mp.status = 'completed';

  select
    bool_or(m.rank = 'A' and r.survived),
    bool_or(m.rank = 'S' and r.survived)
  into v_survived_a, v_survived_s
  from public.mission_participants mp
  join public.missions m        on m.id = mp.mission_id
  join public.mission_rewards r on r.mission_participant_id = mp.id
  where mp.character_id = p_character_id;

  -- O `::text` não é decorativo: sem ele o literal fica sem tipo, o `||`
  -- resolve para "array || array" e o Postgres tenta ler 'first_mission'
  -- como um array literal, abortando a resolução inteira da missão.
  if v_completed >= 1  then v_codes := v_codes || 'first_mission'::text; end if;
  if v_completed >= 5  then v_codes := v_codes || 'road_veteran'::text; end if;
  if coalesce(v_survived_a, false) then v_codes := v_codes || 'cold_blood'::text; end if;
  if coalesce(v_survived_s, false) then v_codes := v_codes || 'faced_death'::text; end if;
  if v_masters >= 3 then v_codes := v_codes || 'no_fixed_party'::text; end if;
  if v_char.level >= 5  then v_codes := v_codes || 'known_name'::text; end if;
  if v_char.level >= 10 then v_codes := v_codes || 'living_legend'::text; end if;
  if v_char.xp >= 1000 then v_codes := v_codes || 'xp_1000'::text; end if;
  if v_char.gold >= 1000 then v_codes := v_codes || 'gold_1000'::text; end if;
  if v_char.status = 'dead' then v_codes := v_codes || 'fallen'::text; end if;

  insert into public.character_achievements (character_id, achievement_id)
  select p_character_id, a.id
  from public.achievements a
  where a.code = any (v_codes)
  on conflict (character_id, achievement_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: resolver missão — TUDO numa transação só.
--
-- p_rewards é um array JSON:
-- [{"character_id":"...","survived":true,"xp":450,"gold":75,
--   "reputation":30,"items":"Espada Longa +1, Poção","notes":"..."}]
--
-- Ou tudo acontece (recompensa + XP + itens + histórico + participação
-- concluída + missão concluída + conquistas), ou nada acontece. É a resposta
-- ao problema P4 da auditoria: XP creditado sem histórico.
-- ---------------------------------------------------------------------
create or replace function public.resolve_mission(
  p_mission_id uuid,
  p_rewards    jsonb
)
returns public.missions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_mission    public.missions%rowtype;
  v_entry      jsonb;
  v_char       public.characters%rowtype;
  v_part       public.mission_participants%rowtype;
  v_xp         int;
  v_gold       int;
  v_rep        int;
  v_survived   boolean;
  v_items      text;
  v_notes      text;
  v_new_xp     int;
  v_new_level  int;
  v_item_name  text;
  v_char_ids   uuid[] := '{}';
  v_id         uuid;
begin
  if v_uid is null then
    raise exception 'Você precisa estar autenticado.' using errcode = 'insufficient_privilege';
  end if;

  -- Trava a missão: duas resoluções simultâneas não creditam recompensa duas vezes.
  select * into v_mission from public.missions where id = p_mission_id for update;
  if not found then
    raise exception 'Missão não encontrada.' using errcode = 'no_data_found';
  end if;
  if v_mission.dm_id <> v_uid then
    raise exception 'Apenas o mestre desta missão pode resolvê-la.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_mission.status = 'completed' then
    raise exception 'Esta missão já foi resolvida.' using errcode = 'check_violation';
  end if;
  if v_mission.status = 'cancelled' then
    raise exception 'Esta missão foi cancelada.' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_rewards) <> 'array' or jsonb_array_length(p_rewards) = 0 then
    raise exception 'Informe as recompensas de pelo menos um participante.'
      using errcode = 'check_violation';
  end if;

  -- Libera a escrita de progressão só dentro desta transação.
  perform set_config('app.progression_write', 'on', true);

  for v_entry in select * from jsonb_array_elements(p_rewards) loop
    v_id := (v_entry ->> 'character_id')::uuid;

    select * into v_part
    from public.mission_participants
    where mission_id = p_mission_id and character_id = v_id
    for update;

    if not found or v_part.status <> 'approved' then
      raise exception 'Só participantes confirmados recebem recompensa.'
        using errcode = 'check_violation';
    end if;

    select * into v_char from public.characters where id = v_id for update;
    if not found then
      raise exception 'Ficha não encontrada.' using errcode = 'no_data_found';
    end if;

    -- trunc(::numeric) e não ::int direto: o campo numérico da tela pode
    -- mandar "450.5", e '450.5'::int aborta a transação inteira.
    v_survived := coalesce((v_entry ->> 'survived')::boolean, true);
    v_xp       := greatest(coalesce(trunc((v_entry ->> 'xp')::numeric), 0), 0)::int;
    v_gold     := greatest(coalesce(trunc((v_entry ->> 'gold')::numeric), 0), 0)::int;
    v_rep      := greatest(coalesce(trunc((v_entry ->> 'reputation')::numeric), 0), 0)::int;
    v_items    := coalesce(v_entry ->> 'items', '');
    v_notes    := coalesce(v_entry ->> 'notes', '');

    -- Quem cai não recebe nada (regra validada com o grupo).
    if not v_survived then
      v_xp := 0; v_gold := 0; v_rep := 0; v_items := '';
    end if;

    insert into public.mission_rewards
      (mission_participant_id, xp, gold, reputation, items, survived, notes)
    values (v_part.id, v_xp, v_gold, v_rep, v_items, v_survived, v_notes)
    on conflict (mission_participant_id) do update
      set xp = excluded.xp, gold = excluded.gold, reputation = excluded.reputation,
          items = excluded.items, survived = excluded.survived, notes = excluded.notes;

    if v_survived then
      v_new_xp    := v_char.xp + v_xp;
      v_new_level := public.level_from_xp(v_new_xp);

      update public.characters
      set xp         = v_new_xp,
          level      = v_new_level,
          gold       = gold + v_gold,
          reputation = reputation + v_rep
      where id = v_id;

      -- Itens: lista separada por vírgula, como na carteirinha.
      for v_item_name in
        select btrim(x)
        from unnest(string_to_array(v_items, ',')) as x
        where btrim(x) <> ''
      loop
        insert into public.character_items (character_id, name, mission_id, description)
        values (v_id, v_item_name, p_mission_id, 'Recompensa de "' || v_mission.title || '".');
      end loop;

      insert into public.character_events
        (character_id, mission_id, event_type, xp_delta, gold_delta, reputation_delta, description)
      values (v_id, p_mission_id, 'mission_reward', v_xp, v_gold, v_rep,
              coalesce(nullif(v_notes, ''), v_mission.title));

      if v_new_level > v_char.level then
        insert into public.character_events
          (character_id, mission_id, event_type, description)
        values (v_id, p_mission_id, 'level_up',
                'Subiu para o nível ' || v_new_level || '.');
      end if;
    else
      update public.characters set status = 'dead' where id = v_id;

      insert into public.character_events
        (character_id, mission_id, event_type, description)
      values (v_id, p_mission_id, 'mission_death',
              coalesce(nullif(v_notes, ''), 'Caiu em "' || v_mission.title || '".'));
    end if;

    update public.mission_participants
    set status = 'completed'
    where id = v_part.id;

    v_char_ids := v_char_ids || v_id;
  end loop;

  -- Quem foi aprovado mas não recebeu linha de recompensa: não compareceu.
  update public.mission_participants
  set status = 'no_show'
  where mission_id = p_mission_id
    and status = 'approved'
    and not (character_id = any (v_char_ids));

  update public.missions
  set status = 'completed'
  where id = p_mission_id
  returning * into v_mission;

  foreach v_id in array v_char_ids loop
    perform public.award_character_achievements(v_id);
  end loop;

  perform set_config('app.progression_write', 'off', true);

  return v_mission;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões de execução
-- ---------------------------------------------------------------------
revoke all on function public.apply_to_mission(uuid, uuid) from public;
revoke all on function public.cancel_participation(uuid) from public;
revoke all on function public.decide_participation(uuid, text) from public;
revoke all on function public.set_mission_status(uuid, text) from public;
revoke all on function public.resolve_mission(uuid, jsonb) from public;
revoke all on function public.award_character_achievements(uuid) from public;

grant execute on function public.apply_to_mission(uuid, uuid) to authenticated;
grant execute on function public.cancel_participation(uuid) to authenticated;
grant execute on function public.decide_participation(uuid, text) to authenticated;
grant execute on function public.set_mission_status(uuid, text) to authenticated;
grant execute on function public.resolve_mission(uuid, jsonb) to authenticated;
grant execute on function public.level_from_xp(int) to authenticated, anon;
grant execute on function public.title_from_reputation(int) to authenticated, anon;
