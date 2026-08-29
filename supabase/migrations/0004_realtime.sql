-- =====================================================================
-- 0004_realtime.sql — publicação de Realtime
--
-- Só as tabelas cuja mudança precisa aparecer na tela de outra pessoa sem
-- refresh. Nada de recompensa/evento aqui: quando uma missão é resolvida,
-- missions e characters mudam junto, e é isso que dispara a recarga.
-- =====================================================================

do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  -- Idempotente: rodar a migration de novo não estoura em
  -- "relation is already member of publication".
  foreach v_table in array array[
    'missions', 'mission_participants', 'characters', 'guilds'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I', v_table
      );
    end if;
  end loop;
end
$$;

-- REPLICA IDENTITY FULL: o payload de DELETE/UPDATE traz a linha inteira,
-- não só a PK — a UI precisa saber qual missão mudou para recarregar só ela.
alter table public.missions             replica identity full;
alter table public.mission_participants replica identity full;
alter table public.characters           replica identity full;
alter table public.guilds               replica identity full;
