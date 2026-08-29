-- =====================================================================
-- 0005_achievements_catalog.sql
--
-- Catálogo de conquistas. NÃO é seed de desenvolvimento: é dado de
-- referência do produto, versionado junto com o schema, e a RPC
-- award_character_achievements depende destes `code`s existirem.
--
-- `icon` é o nome do ícone lucide usado na UI.
-- Escopo "character": concedido pela RPC, gravado em character_achievements.
-- Escopo "player":    derivado na UI (títulos do jogador) — nunca gravado.
-- =====================================================================

insert into public.achievements (code, name, description, icon, scope) values
  ('first_mission',  'Primeira Missão',        'Completou a primeira missão.',                    'scroll-text', 'character'),
  ('road_veteran',   'Veterano de Estrada',    'Completou 5 missões.',                            'scroll-text', 'character'),
  ('cold_blood',     'Sangue Frio',            'Sobreviveu a uma missão de rank A.',              'flame',       'character'),
  ('faced_death',    'Encarou a Morte',        'Sobreviveu a uma missão de rank S.',              'flame',       'character'),
  ('no_fixed_party', 'Sem Grupo Fixo',         'Jogou com 3 mestres diferentes.',                 'users',       'character'),
  ('known_name',     'Nome Conhecido',         'Alcançou o nível 5.',                             'star',        'character'),
  ('living_legend',  'Lenda Viva',             'Alcançou o nível 10.',                            'crown',       'character'),
  ('xp_1000',        'Mil de Experiência',     'Acumulou 1.000 XP.',                              'sparkles',    'character'),
  ('gold_1000',      'Mil Moedas',             'Acumulou 1.000 peças de ouro.',                   'coins',       'character'),
  ('fallen',         'Caído em Combate',       'Esta ficha encerrou a jornada em missão.',        'skull',       'character'),

  ('dm_first',       'Mestre Novato',          'Mestrou a primeira missão.',                      'scroll-text', 'player'),
  ('dm_veteran',     'Mestre Veterano',        'Mestrou 10 missões.',                             'crown',       'player'),
  ('grave_keeper',   'Colecionador de Túmulos','Perdeu 2 ou mais fichas em batalha.',             'skull',       'player'),
  ('natural_born',   'Sobrevivente Nato',      'Tem uma ficha viva no nível 5 ou mais.',          'shield',      'player'),
  ('wanderer',       'Andarilho',              'Jogou com 3 mestres diferentes.',                 'users',       'player')
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      icon        = excluded.icon,
      scope       = excluded.scope;
