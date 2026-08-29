# IMPLEMENTATION_PLAN.md — Quadro de Missões

Documento de auditoria + plano de implementação. Escrito na Fase 1/2, antes de
qualquer código de produto. Atualizado ao final com o que foi de fato entregue.

---

## 1. Auditoria — o que existia antes

### 1.1 Onde o projeto estava

A pasta de trabalho (`C:\Users\higor\Desktop\Quadro v3`) estava **vazia**. O
protótipo real vive em `C:\Users\higor\Desktop\Quadro de Missões`:

```
Quadro de Missões/
├── CLAUDE.md                  21 KB — contexto, regras de negócio, decisões
├── quadro-de-missoes.jsx      73 KB — protótipo React canônico (1527 linhas, arquivo único)
├── preview/
│   ├── index.html             cópia com Babel Standalone + Tailwind CDN (teste local)
│   └── artifact-test.html     cópia do build self-contained para teste
└── build/
    ├── app-source.jsx         variante do app para o modelo do Artifact
    ├── boot.js                bootstrap self-contido (injeta React/Babel/CSS)
    ├── assemble.ps1           "bundler" em PowerShell (concatenação de texto)
    ├── utilities.css          subconjunto de utilitários Tailwind escrito à mão
    ├── live-state.json        snapshot do estado real dos jogadores
    ├── vendor/                react, react-dom, babel, ícones lucide inline
    └── quadro-artifact.html   saída publicada como Claude Artifact
```

Também existe `Quadro de missoes 2/GuildaAventureiros/` — um exercício em **Java**
(`Aventureiro.java`, `Guilda.java`, `Missao.java`) que serviu de material de
referência para o sistema de ranks. Não é código do produto.

### 1.2 Stack detectada

| Camada | O que era |
|---|---|
| Framework | Nenhum. React via `<script>` (UMD) + Babel Standalone compilando JSX **no navegador** |
| Linguagem | JavaScript (JSX), sem TypeScript, sem tipos |
| Rotas | Nenhuma. SPA de arquivo único com `useState("quadro" \| "fichas" \| "guildas" \| "mural")` |
| Componentes | 15 componentes num único arquivo de 1527 linhas |
| Estado | `useState` no componente `App` + prop drilling |
| Estilos | Inline styles (tokens em constantes JS) + classes Tailwind; Tailwind por CDN no preview, e um `utilities.css` escrito à mão no build |
| Build | `assemble.ps1` — concatenação de strings em PowerShell, sem bundler |
| Banco | **Nenhum.** `window.storage` (KV do Artifact) na versão canônica; `artifact.publish(html)` na versão online |
| Auth | **Nenhuma.** Um input de nome salvo em `localStorage` |
| Env vars | Nenhuma |
| Testes | Nenhum framework. Validação por "simulações" manuais |
| Toolchain | **Node/npm não instalados na máquina** |

### 1.3 Telas já implementadas (e que devem ser preservadas)

1. **Portão de entrada** — logo, "Diga como o grupo deve te chamar antes de entrar na taverna", input, botão "Entrar na taverna".
2. **Quadro de Missões** — contador de missões abertas, botão "+ Publicar missão", cards com selo de rank, histórico abaixo.
3. **Minhas Fichas** — "N/3 fichas cadastradas", botão "+ Nova ficha", grid de cards com XP/ouro/PV/CA/REP/troféus.
4. **Guildas** — ranking de guildas por reputação + "Aventureiros em destaque".
5. **Mural de Conquistas** — títulos do jogador + troféus por ficha.
6. **Modais** — Nova Ficha, Carteirinha (ficha completa), Publicar Missão, Nova Guilda, Inscrever-se, Resolver Missão.

### 1.4 Problemas encontrados

| # | Problema | Gravidade |
|---|---|---|
| P1 | **Sem autenticação.** Qualquer pessoa digita qualquer nome e vira aquele jogador. Digitar "Sigmound" dá controle sobre as missões do Sigmound. | Crítico |
| P2 | **Sem autorização real.** Todas as checagens (`quest.mestre === playerName`, limite de 3 fichas, dono da ficha) são só de frontend. O storage é compartilhado e gravável por qualquer um. | Crítico |
| P3 | **Persistência dependente de "share pin".** Documentado no CLAUDE.md: quem abre o link vê uma versão congelada; o dado salva na versão viva mas a pessoa continua olhando a antiga → "nada permanece online". Não é corrigível por ferramenta; é limitação da arquitetura de Artifact. | Crítico |
| P4 | **Resolução de missão não é transacional.** `handleResolve` faz N escritas independentes (personagem, inscrição, missão). Falha no meio = XP creditado sem histórico, ou missão concluída sem recompensa. | Alto |
| P5 | **Sem realtime.** Polling de 7 s (`setInterval`) relendo *todas* as chaves. | Alto |
| P6 | **Sem histórico de aventuras.** O resultado fica dentro da inscrição; não há uma linha do tempo "de onde veio esse XP" por personagem. | Alto |
| P7 | **Conflito de escrita concorrente.** Mitigado com chave granular + retry (4 rodadas de correção), mas sem transação real — a própria doc do projeto recomenda migrar para um backend transacional. | Alto |
| P8 | **Sem estados de missão.** Só `aberta`/`cancelada`/`concluida`. Não há `full`/`in_progress`. Nada impede inscrição acima da lotação. | Médio |
| P9 | **Sem arquivamento de ficha.** O limite de 3 é definitivo; a única saída é morrer. | Médio |
| P10 | **Itens como string livre** concatenada num array — sem quantidade, sem origem. | Médio |
| P11 | **Sem loading/error states.** Falha de escrita cai em `console.error` e a UI segue como se tivesse salvo. | Médio |
| P12 | **Três cópias do mesmo código** (`quadro-de-missoes.jsx`, `build/app-source.jsx`, `preview/index.html`) que precisam ser editadas em paralelo à mão. | Médio |
| P13 | **Sem responsividade real** — largura fixa `max-w-3xl`, tabs em linha única que estouram no celular, modal `max-h-[88vh]` com scroll problemático. | Médio |
| P14 | Duplicidade de inscrição do mesmo usuário com fichas diferentes não é bloqueada. | Médio |

### 1.5 Dados só em memória / localStorage

- `player-name` → `localStorage` (identidade do jogador — a raiz do P1).
- `characters`, `quests`, `guilds` → `window.storage` (KV do Artifact) ou serializados dentro do próprio HTML publicado.
- Troféus e títulos → **derivados em tempo de render**, nunca persistidos.
- Não há nenhum array hardcoded fingindo ser backend: o protótipo já lê de um storage real, só que inadequado.

### 1.6 O que precisava ir para banco/backend

Tudo o que hoje é KV: perfis, personagens, missões, inscrições, recompensas, itens, eventos, guildas, conquistas. Mais: autenticação de verdade e autorização no servidor.

---

## 2. Regras de negócio herdadas (não renegociadas)

Vindas do `CLAUDE.md` do protótipo, já validadas com o grupo real:

- Até **3 fichas ativas** por jogador.
- A ficha é uma **"carteirinha"** — resumo de mesa. A ficha 5e completa vive no **Roll20** (campo `roll20_url`). **Sem automação**: atributos, PV e CA são números manuais; nada é derivado de raça/classe.
- **Nível, XP, ouro e reputação não são editáveis pelo jogador.** Só entram pela resolução de missão feita pelo mestre.
- **Nível é 100% derivado do XP** (tabela 5e, cap nível 20).
- **Rank F/D/C/B/A/S** carrega *sugestão* de nível/XP/ouro/reputação que pré-preenche o formulário de resolução — mas o mestre define tudo manualmente, por jogador.
- **Morte é permanente** ao cair em missão. Ficha morta não se inscreve mais.
- **Reputação** é stat separado do XP, creditado manualmente pelo mestre. O **título** (Novato → Aventureiro → Aventureiro Renomado → Veterano → Campeão → Lenda da Guilda) é 100% derivado da faixa de reputação.
- **Reputação da guilda nunca é editável** — é sempre a soma da reputação dos membros.
- **Conquistas são derivadas do histórico**, nunca input manual.
- Nível sugerido da missão é indicativo: **nunca bloqueia inscrição**.

---

## 3. Stack escolhida

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | **Next.js 16 (App Router)** + React 19 | Pedido explícito; deploy Vercel de primeira |
| Linguagem | **TypeScript** (strict) | Pedido explícito; elimina a classe de bug de campo renomeado que o protótipo tinha |
| Estilo | **Tailwind v4** + tokens do protótipo em CSS vars | Preserva o visual; substitui o `utilities.css` manual |
| Ícones | **lucide-react** | Já era a biblioteca de ícones do protótipo |
| Banco | **Supabase / PostgreSQL** | Pedido explícito; resolve P3, P4, P7 |
| Auth | **Supabase Auth** (e-mail + senha) | Resolve P1 |
| Realtime | **Supabase Realtime** (postgres_changes) | Resolve P5 |
| Autorização | **RLS + funções RPC `SECURITY DEFINER`** | Resolve P2 |
| Testes | **Vitest** | Sem infra de teste antes; Vitest é o mais leve para o domínio puro |

**Node.js não existia na máquina.** Instalei uma cópia portátil (v24.20.0) em
`%LOCALAPPDATA%\nodejs-portable` e a acrescentei ao PATH do usuário. Sem isso
não há `npm`, `next build`, lint, typecheck nem testes.

Migração de framework é justificada, não é preferência: o protótipo não tem
framework nenhum (JSX compilado no navegador), então não há "stack adequada" a
preservar. **O que se preserva é o design e as regras**, portados 1:1.

---

## 4. Estrutura de banco proposta

Nomes de tabela/coluna em inglês (convenção Postgres/Supabase); rótulos de UI
continuam em português.

```
profiles(id→auth.users, username UNIQUE, email, created_at, updated_at)

characters(id, user_id→profiles, name, class, race, level, xp, gold, reputation,
           current_hp, max_hp, armor_class, guild_id→guilds, roll20_url, notes,
           status(alive|dead), active, archived_at, created_at, updated_at)

character_items(id, character_id→characters, name, quantity, description,
                mission_id→missions, created_at)

missions(id, dm_id→profiles, title, description, scheduled_at, min_level,
         max_level, max_players, min_players, rank(F..S), suggested_reward,
         suggested_classes text[], status(open|full|in_progress|completed|cancelled),
         created_at, updated_at)

mission_participants(id, mission_id, character_id, user_id,
                     status(pending|approved|rejected|cancelled|completed|no_show),
                     joined_at, approved_at, rejected_at, notes,
                     UNIQUE(mission_id, character_id), UNIQUE(mission_id, user_id))

mission_rewards(id, mission_participant_id UNIQUE, xp, gold, reputation, items,
                survived, notes, created_at)

character_events(id, character_id, mission_id, event_type, xp_delta, gold_delta,
                 reputation_delta, description, created_at)

guilds(id, name UNIQUE, founder_id→profiles, motto, description, created_at)

achievements(id, code UNIQUE, name, description, icon, scope(character|player), created_at)
character_achievements(id, character_id, achievement_id, mission_id, awarded_at,
                       UNIQUE(character_id, achievement_id))
```

**Decisões documentadas (onde me afastei do esqueleto do pedido):**

1. **`guild_members` é uma VIEW, não tabela.** A regra "uma ficha pertence a no
   máximo uma guilda" é expressa direto por `characters.guild_id`. Uma tabela de
   junção permitiria estado inválido (mesma ficha em duas guildas) que exigiria
   uma constraint extra para proibir. A separação conceitual é mantida pela view
   `guild_members` e pela view `guild_reputation` (soma derivada).
2. **`mission_rewards.reputation` foi acrescentado** — o esqueleto do pedido não
   tinha, mas a regra de negócio validada exige reputação por jogador.
3. **`missions.min_players`** acrescentado — o protótipo tem "mínimo p/ não cancelar".
4. **`characters.status`** ('alive'/'dead') separado de `active` — morte é regra
   de jogo (permanente, bloqueia inscrição); `active` é arquivamento (libera vaga
   nas 3 fichas sem apagar histórico).
5. **Itens ganharam `mission_id`** para o histórico saber de onde cada item veio.
6. **Conquistas são derivadas mas persistidas**: nenhuma policy permite INSERT
   pelo cliente; só a RPC de resolução grava, calculando a partir do histórico.
   Isso concilia "derivadas, nunca manuais" com o `awarded_at` do pedido.
7. **`level` é coluna, mas nunca é escrita pelo cliente** — a RPC recalcula por
   `level_from_xp(xp)`. Fica materializada para ordenar/filtrar sem recalcular.

### Consistência transacional

A resolução é uma única função `resolve_mission(p_mission_id, p_rewards jsonb)`,
`SECURITY DEFINER`, que numa transação: valida que quem chama é o mestre → grava
`mission_rewards` → soma XP/ouro/reputação e recalcula nível → grava
`character_items` → grava `character_events` → marca participantes `completed` →
marca a missão `completed` → concede conquistas. Resolve o P4 direto.

---

## 5. Regras de autorização (RLS)

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | autenticados | próprio id | próprio id | — |
| `characters` | autenticados | próprio `user_id`, ≤3 ativas (trigger) | dono, **sem tocar xp/gold/reputation/level/status** (trigger) | — |
| `character_items` | autenticados | dono da ficha | dono | dono |
| `missions` | autenticados | próprio `dm_id` | só o mestre | — |
| `mission_participants` | autenticados | dono da ficha, missão `open` | dono (só cancelar) **ou** mestre (aprovar/recusar/remover) | — |
| `mission_rewards` | autenticados | **ninguém** (só a RPC) | ninguém | ninguém |
| `character_events` | autenticados | **ninguém** (só a RPC) | ninguém | ninguém |
| `guilds` | autenticados | autenticado (vira `founder_id`) | só o fundador | — |
| `achievements` | autenticados | ninguém | ninguém | ninguém |
| `character_achievements` | autenticados | **ninguém** (só a RPC) | ninguém | ninguém |

Reforços que RLS sozinha não expressa, feitos em **trigger**:
- limite de 3 fichas ativas;
- jogador não altera xp/gold/reputation/level/status/user_id da própria ficha;
- lotação da missão ao aprovar;
- inscrição só em missão `open`;
- ficha morta ou arquivada não se inscreve;
- um personagem por usuário por missão.

---

## 6. Ordem de implementação

| Fase | Entrega |
|---|---|
| 3 | Migrations SQL (tabelas, índices, constraints, views, funções, triggers, RLS, seed de conquistas) |
| 4 | Supabase Auth + middleware de sessão + rotas protegidas |
| 5 | Perfis e personagens (CRUD, limite de 3, arquivar) |
| 6 | Quadro de Missões lendo do banco |
| 7 | Publicar missão |
| 8 | Inscrições com estados |
| 9 | Painel do mestre (aprovar/recusar/remover) |
| 10 | Resolução + recompensas via RPC transacional |
| 11 | Histórico por personagem |
| 12 | Realtime |
| 13 | Guildas |
| 14 | Conquistas |
| 15 | Responsividade + loading/empty/error |
| 16 | Testes (Vitest + SQL) |
| 17 | Lint, typecheck, build |
| 18 | DEPLOY.md, README.md, .env.example |

---

## 7. Preservação visual

Os tokens do protótipo viram CSS variables com o **mesmo valor hexadecimal**:

```
INK #1B1712 · PANEL #EFE4C8 · PANEL_DARK #E3D5AE · BRASS #C9A227
BRASS_DIM #8C7327 · BLOOD #8C3A32 · MOSS #3F5D42 · INK_TEXT #2A2318 · MUTED #6B5F45
```

Tipografia idêntica: **Cinzel** (títulos/botões), **Spectral** (texto),
**JetBrains Mono** (números/metadados). Mantidos: selo circular de rank com
gradiente radial, cards de pergaminho com borda latão, tabs com aba ativa cor de
pergaminho e sublinhado dourado, textos temáticos ("Entrar na taverna", "O quadro
está vazio. Que tal ser o primeiro a mestrar?").

Mudanças de responsividade permitidas (não descaracterizam): tabs com scroll
horizontal no celular, modal com `100dvh` e área de scroll interna, grids que
colapsam para 1 coluna.

---

## 8. O que depende de ação externa

O código fica completo, mas **um projeto Supabase precisa ser criado pelo dono do
produto** — isso exige conta e credenciais que não posso criar. Sem
`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` o app compila,
lint/typecheck/testes passam e a UI sobe, mas nenhuma leitura/escrita real
acontece. Passo a passo em `DEPLOY.md`.

---

## 9. O que foi entregue (fechamento)

### Como cada problema da auditoria foi resolvido

| # | Problema | Resolução |
|---|---|---|
| P1 | Sem autenticação | Supabase Auth (e-mail + senha), perfil criado por trigger, sessão em cookie renovada no `proxy.ts` |
| P2 | Sem autorização real | RLS nas 10 tabelas + triggers + RPCs `SECURITY DEFINER` que conferem `auth.uid()` |
| P3 | Persistência dependente de "share pin" | Postgres. Cada linha é uma linha |
| P4 | Resolução não transacional | RPC `resolve_mission` — uma transação com `FOR UPDATE` na missão |
| P5 | Sem realtime | Supabase Realtime, um canal, 4 tabelas, recarga com folga de 250 ms |
| P6 | Sem histórico | `character_events` + `character_items.mission_id` + modal de histórico |
| P7 | Escrita concorrente | Transação real; `FOR UPDATE` impede resolução dupla |
| P8 | Sem estados de missão | `open/full/in_progress/completed/cancelled`, com `open ↔ full` automático |
| P9 | Sem arquivamento | `active` + `archived_at`; limite de 3 conta só as ativas; histórico intacto |
| P10 | Itens como string | Tabela `character_items` com quantidade, descrição e origem |
| P11 | Sem loading/error states | `LoadingState`, `EmptyState`, `ErrorState`, toasts e confirmação antes de ação destrutiva |
| P12 | Três cópias do código | Uma base só |
| P13 | Sem responsividade | Abas com rolagem horizontal, modal `100dvh`, grids que colapsam, inputs 16px no celular |
| P14 | Inscrição duplicada por usuário | Índice único parcial + verificação na RPC |

### Fases

Todas as 18 fases do escopo foram executadas e verificadas contra um banco real.

### Verificado de fato

Com o projeto Supabase provisionado (`duljydwvovtkqkttbtwf`, região sa-east-1):

- **As 5 migrations aplicaram** com o runner do projeto (`npm run migrate`).
  Schema conferido no banco: 10 tabelas, **RLS ligada em todas**, 23 policies,
  2 views, 16 funções, 13 triggers, 4 tabelas publicadas no Realtime, catálogo
  de 15 conquistas, `level_from_xp` e `title_from_reputation` respondendo certo.
- **`npm test` — 61 testes, todos passando**, sendo 20 de integração contra o
  banco de verdade (RLS, triggers, RPCs, transação de recompensa), com criação
  e limpeza automática das contas de teste.
- **Fluxo completo exercitado no navegador**, ponta a ponta: cadastro → ficha →
  publicar missão → inscrição de dois jogadores → aprovação → resolução com
  XP/ouro/reputação/itens **diferentes por personagem** → histórico → conquista
  → visão do jogador com "Seu resultado". Conferido no banco depois: Arannis
  450 XP / 75 PO / 120 REP / nível 2 / "Espada Longa +1"; Lyra 300 XP / 50 PO /
  30 REP / nível 2 / "Poção de Cura" + "Adaga +1". Cada item com o `mission_id`
  de origem, histórico com os deltas e o `level_up`, missão e participações em
  `completed`.
- **Realtime confirmado nos dois sentidos**: uma ação disparada fora do
  navegador (outro jogador, via cliente Node) apareceu e sumiu da tela do mestre
  sem nenhum refresh.
- `npm run lint` — limpo (inclui as regras do React Compiler).
- `npm run typecheck` — limpo.
- `npm run build` — sem avisos; todas as rotas do quadro dinâmicas.
- Tokens de cor conferidos no navegador contra os valores do protótipo.
- Tipografia conferida: Cinzel nos títulos, Spectral no corpo, JetBrains Mono
  nos metadados.
- Celular (375×812): sem rolagem horizontal, inputs a 16px.
- Banco devolvido limpo ao fim: 0 usuários, 0 fichas, 0 missões, 0 guildas;
  só o catálogo de conquistas permanece.

### Bugs encontrados e corrigidos durante a verificação

Nenhum deles apareceria sem rodar o sistema de verdade:

1. **Tipografia inteira caindo para o padrão do navegador.** As variáveis do
   `next/font` estavam no `<body>` e os tokens `--font-display/body/mono` em
   `:root`. Uma custom property resolve `var()` no elemento onde é declarada;
   com a fonte só no `<body>`, `--font-display` computava vazio. Corrigido
   movendo as variáveis para o `<html>`.
2. **`resolve_mission` abortava ao conceder conquista.** `v_codes ||
   'first_mission'` — com o literal sem tipo, o `||` resolve para
   "array || array" e o Postgres tentava ler `first_mission` como array
   literal (`malformed array literal`). A missão era resolvida e falhava
   inteira, na hora de premiar. Corrigido com `::text` explícito.
3. **Realtime assinava com sucesso e nunca entregava evento.** O socket
   conectava como `anon`; como todas as policies de SELECT são `to
   authenticated`, a RLS filtrava tudo. Corrigido com
   `realtime.setAuth(token)` antes de assinar, re-aplicado quando o token é
   renovado. No caminho, o `.subscribe()` ganhou callback de status e a UI
   ganhou um aviso "sem tempo real" — a falha era invisível.
4. **`'450.5'::int` abortaria a resolução** se alguém digitasse decimal no
   campo de XP. Trocado por `trunc(::numeric)`.
5. **`alter publication` estourava ao reaplicar a migration.** Envolvido em
   verificação de idempotência; os triggers viraram `create or replace`.

### Decisões tomadas sem perguntar (conforme o item 32 do escopo)

1. **Node.js instalado.** A máquina não tinha Node/npm — sem isso não há build,
   lint, typecheck nem teste. Instalei uma cópia portátil em
   `%LOCALAPPDATA%\nodejs-portable` e a acrescentei ao PATH do usuário.
2. **`guild_members` como view**, não tabela (ver seção 4, decisão 1).
3. **Conquistas de ficha persistidas; títulos de jogador derivados na UI** — as
   duas coisas continuam "derivadas, nunca manuais".
4. **`in_progress` é manual** (botão "Iniciar" para o mestre), não por horário.
5. **Recusar é o mesmo que remover** um participante já confirmado — evita um
   estado a mais para a mesma intenção.
6. **Apagar item da carteirinha remove a linha**, inclusive item vindo de missão
   (consumível gasto). O `character_events` da aventura permanece.
7. **Migração de dados do protótipo não foi automatizada** — são 3 personagens,
   1 guilda e 1 missão; recadastrar é mais seguro (ver `DEPLOY.md`, seção 11).
