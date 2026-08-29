-- =====================================================================
-- 0003_rls.sql — Row Level Security
--
-- Nada aqui depende de checagem no frontend. Se a UI for contornada
-- (console do navegador, curl com a anon key), estas policies continuam
-- valendo — e as tabelas de recompensa/histórico/conquista não têm
-- NENHUMA policy de escrita: só as RPCs SECURITY DEFINER escrevem nelas.
-- =====================================================================

alter table public.profiles               enable row level security;
alter table public.guilds                 enable row level security;
alter table public.characters             enable row level security;
alter table public.missions               enable row level security;
alter table public.mission_participants   enable row level security;
alter table public.mission_rewards        enable row level security;
alter table public.character_items        enable row level security;
alter table public.character_events       enable row level security;
alter table public.achievements           enable row level security;
alter table public.character_achievements enable row level security;

-- ---------------------------------------------------------------------
-- Grants de tabela (o gate fino é a policy; isto é só o gate grosso)
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated, anon;

grant select                         on public.profiles               to authenticated;
grant insert, update                 on public.profiles               to authenticated;
grant select, insert, update         on public.guilds                 to authenticated;
grant select, insert, update         on public.characters             to authenticated;
grant select, insert, update         on public.missions               to authenticated;
grant select, insert, update         on public.mission_participants   to authenticated;
grant select                         on public.mission_rewards        to authenticated;
grant select, insert, update, delete on public.character_items        to authenticated;
grant select                         on public.character_events       to authenticated;
grant select                         on public.achievements           to authenticated;
grant select                         on public.character_achievements to authenticated;
grant select                         on public.guild_members          to authenticated;
grant select                         on public.guild_reputation       to authenticated;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- characters
-- Ler é aberto (o quadro mostra as fichas dos outros); escrever é só do dono.
-- XP/ouro/reputação/nível/status são barrados pelo trigger
-- protect_character_progression, não pela policy — a policy sozinha não
-- consegue proibir a mudança de UMA coluna.
-- ---------------------------------------------------------------------
create policy "characters_select_authenticated"
  on public.characters for select
  to authenticated
  using (true);

create policy "characters_insert_own"
  on public.characters for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "characters_update_own"
  on public.characters for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Sem policy de DELETE: o histórico de uma ficha é permanente.
-- Para liberar espaço nas 3 fichas, arquive (active = false).

-- ---------------------------------------------------------------------
-- character_items — inventário da carteirinha
-- ---------------------------------------------------------------------
create policy "character_items_select_authenticated"
  on public.character_items for select
  to authenticated
  using (true);

create policy "character_items_insert_own"
  on public.character_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.characters c
      where c.id = character_id and c.user_id = (select auth.uid())
    )
  );

create policy "character_items_update_own"
  on public.character_items for update
  to authenticated
  using (
    exists (
      select 1 from public.characters c
      where c.id = character_id and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.characters c
      where c.id = character_id and c.user_id = (select auth.uid())
    )
  );

create policy "character_items_delete_own"
  on public.character_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.characters c
      where c.id = character_id and c.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- guilds
-- ---------------------------------------------------------------------
create policy "guilds_select_authenticated"
  on public.guilds for select
  to authenticated
  using (true);

create policy "guilds_insert_own"
  on public.guilds for insert
  to authenticated
  with check (founder_id = (select auth.uid()));

create policy "guilds_update_founder"
  on public.guilds for update
  to authenticated
  using (founder_id = (select auth.uid()))
  with check (founder_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- missions
-- ---------------------------------------------------------------------
create policy "missions_select_authenticated"
  on public.missions for select
  to authenticated
  using (true);

create policy "missions_insert_as_dm"
  on public.missions for insert
  to authenticated
  with check (dm_id = (select auth.uid()));

create policy "missions_update_dm_only"
  on public.missions for update
  to authenticated
  using (dm_id = (select auth.uid()))
  with check (dm_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- mission_participants
-- O jogador cria/cancela a própria inscrição; o mestre administra as
-- inscrições das missões dele. Ninguém mexe na inscrição de terceiros.
-- ---------------------------------------------------------------------
create policy "participants_select_authenticated"
  on public.mission_participants for select
  to authenticated
  using (true);

create policy "participants_insert_own"
  on public.mission_participants for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.characters c
      where c.id = character_id and c.user_id = (select auth.uid())
    )
  );

create policy "participants_update_own_or_dm"
  on public.mission_participants for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.missions m
      where m.id = mission_id and m.dm_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.missions m
      where m.id = mission_id and m.dm_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- mission_rewards / character_events / character_achievements
-- Leitura para todos os autenticados. Escrita: NENHUMA policy — só as
-- funções SECURITY DEFINER conseguem gravar.
-- ---------------------------------------------------------------------
create policy "rewards_select_authenticated"
  on public.mission_rewards for select
  to authenticated
  using (true);

create policy "events_select_authenticated"
  on public.character_events for select
  to authenticated
  using (true);

create policy "achievements_select_authenticated"
  on public.achievements for select
  to authenticated
  using (true);

create policy "character_achievements_select_authenticated"
  on public.character_achievements for select
  to authenticated
  using (true);
