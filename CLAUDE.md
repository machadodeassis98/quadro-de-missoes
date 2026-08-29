@AGENTS.md

# Quadro de Missões — contexto do projeto

Sistema de quadro de missões de RPG de mesa (D&D 5e) para um grupo de amigos
**sem grupo fixo**. Quem quer mestrar publica uma missão; os outros inscrevem
uma das suas fichas; o mestre aprova e, no fim, distribui XP, ouro e itens
**manualmente, por jogador**. Só o personagem que jogou aquela missão evolui.

Leia `README.md` para a estrutura e `IMPLEMENTATION_PLAN.md` para a auditoria do
protótipo antigo e o porquê de cada decisão de arquitetura.

## Regras de negócio validadas com o grupo

**Não renegocie nenhuma delas sem confirmação explícita do usuário.** Elas vêm
do protótipo anterior, já testado com os jogadores reais.

- Até **3 fichas ativas** por jogador. Arquivar libera espaço e **nunca apaga
  histórico**.
- A ficha é uma **"carteirinha"** — resumo de mesa. A ficha 5e completa vive no
  **Roll20** (campo `roll20_url`). **Sem automação**: atributos, PV e CA são
  números manuais; nada é derivado de raça ou classe. Não reintroduza fórmula de
  PV, bônus racial, perícias, salvaguardas por classe nem créditos de ASI — isso
  foi removido de propósito, com aprovação do usuário, porque era a maior fonte
  de bugs.
- **XP, ouro, reputação, nível e status não são editáveis pelo jogador.** Só
  entram pela resolução da missão. Garantido pelo trigger
  `protect_character_progression`, não pela UI.
- **Nível é 100% derivado do XP** (tabela 5e, teto no 20).
- **Rank F/D/C/B/A/S** carrega só uma *sugestão* que pré-preenche o formulário
  de resolução. O mestre altera tudo, por jogador. Rank nunca credita sozinho.
- **Nível sugerido é indicativo** — nunca bloqueia inscrição.
- **Uma ficha por jogador por missão.**
- **Morte é permanente.** Quem cai não recebe nada e a ficha não volta ao quadro.
- **Reputação** é stat separado do XP, creditado pelo mestre. O **título** é
  derivado da faixa (Novato → Aventureiro → Aventureiro Renomado → Veterano →
  Campeão → Lenda da Guilda).
- **Reputação da guilda nunca é campo editável** — é a soma dos membros
  (view `guild_reputation`).
- **Conquistas são derivadas do histórico**, nunca concedidas à mão.
- Sem sistema de avaliação de jogador — o mural de conquistas ocupa esse lugar.

## Identidade visual — preservar

Estética de taverna medieval. Os hexadecimais vêm do protótipo e estão em
`src/app/globals.css` como tokens do Tailwind v4:

```
ink #1B1712 · ink-soft #241F17 · ink-text #2A2318
panel #EFE4C8 · panel-dark #E3D5AE · panel-light #FAF5E4
brass #C9A227 · brass-dim #8C7327
blood #8C3A32 · moss #3F5D42 · muted #6B5F45 · faint #B8AD8E
```

Fontes: **Cinzel** (títulos e botões), **Spectral** (texto), **JetBrains Mono**
(números e metadados). Não troque por dashboard genérico, gradiente moderno nem
glassmorphism. Textos temáticos ("Entrar na taverna", "O quadro está vazio. Que
tal ser o primeiro a mestrar?") fazem parte do produto.

**Armadilha já resolvida:** as variáveis do `next/font` ficam no `<html>`, não
no `<body>`. Os tokens `--font-display/body/mono` são declarados em `:root` e
apontam para elas; com as fontes no `<body>`, `--font-display` computa vazio e a
tipografia inteira cai no padrão do navegador. Ver comentário em
`src/app/layout.tsx`.

## Armadilhas que já custaram caro (não reintroduza)

Todas foram encontradas rodando o sistema de verdade, não lendo o código:

1. **`realtime.setAuth(token)` antes de `.subscribe()`.** Sem isso o socket
   conecta como `anon`; como toda policy de SELECT é `to authenticated`, a RLS
   filtra tudo. O canal responde `SUBSCRIBED` normalmente e nunca entrega
   evento. Ver `src/lib/data/board-provider.tsx`.
2. **`||` com literal sem tipo em `text[]`.** `v_codes || 'first_mission'`
   resolve para "array || array" e o Postgres tenta ler o literal como array
   (`malformed array literal`). Sempre `::text`.
3. **`'450.5'::int` aborta a transação.** Campo numérico da tela pode mandar
   decimal; usar `trunc(::numeric)`.
4. **Conexão direta do Supabase é IPv6-only.** Para migrations e testes, usar a
   URI do **Session pooler** (`aws-0-<região>.pooler.supabase.com:5432`).
5. **Usuário criado à mão em `auth.users` precisa das colunas de token como
   `''`, não `NULL`** — o GoTrue responde "Database error querying schema".
   Ver `tests/integration/helpers.ts`.
6. **O limite de 3 fichas vale nos testes também**: cada teste que cria ficha
   precisa do próprio usuário, senão a suíte se derruba sozinha.

## Arquitetura

- **Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase.**
- Regra pura → `src/lib/domain/`. Query/mutação → `src/lib/data/api.ts` (nenhum
  componente fala com o Supabase direto). Estado + realtime →
  `src/lib/data/board-provider.tsx`.
- **Regra importante vive no banco.** RLS em todas as tabelas; aprovar, recusar,
  inscrever e resolver passam por RPC `SECURITY DEFINER` que confere quem chama.
  `mission_rewards`, `character_events` e `character_achievements` não têm
  policy de escrita nenhuma.
- **`resolve_mission` é transacional**: recompensa + XP/ouro/reputação + itens +
  histórico + participação + missão concluída + conquistas, ou tudo, ou nada.
  Isso existe porque o protótipo antigo fazia N escritas soltas e podia creditar
  XP sem gravar histórico.
- O protótipo antigo passou por 4 rodadas de correção de bugs de concorrência
  com storage chave-valor. **Não replique aquele padrão** (chave granular +
  retry + polling): aqui há transação de verdade.

## Como o usuário quer trabalhar

- Antes de mudança estrutural, explique o plano e o porquê antes de reescrever.
- Ao corrigir bug, escreva o teste que reproduz antes da correção.
- Ao final de uma sessão relevante, atualize este arquivo com o que mudou de
  arquitetura ou de regra de negócio.

## No ar

- **App:** <https://quadro-de-missoes-peach.vercel.app>
- **Repositório:** <https://github.com/machadodeassis98/quadro-de-missoes> (público)
- **Supabase:** projeto `duljydwvovtkqkttbtwf`, região sa-east-1

Fluxo completo validado em produção: cadastro, ficha, missão, inscrição de dois
jogadores, aprovação, resolução com recompensas individuais, histórico,
conquistas e Realtime — tudo conferido no banco depois.

## Estado atual

**Em produção-pronto e verificado contra banco real.** Projeto Supabase
`duljydwvovtkqkttbtwf` (sa-east-1) provisionado, 5 migrations aplicadas, RLS
ligada nas 10 tabelas, Realtime publicando 4 tabelas.

- `npm run lint`, `npm run typecheck`, `npm run build`: limpos.
- `npm test`: 61 testes passando (41 de domínio + 20 de integração contra o
  banco). Os de integração precisam da `DATABASE_URL` (session pooler) e pulam
  sozinhos sem ela.
- Fluxo completo exercitado no navegador ponta a ponta, incluindo recompensas
  individuais por personagem e Realtime entre dois jogadores.
- Banco entregue limpo: 0 contas, 0 fichas, 0 missões. Só o catálogo de 15
  conquistas.

**Pendências que dependem do usuário:**
- Desligar **Confirm email** em Authentication → Sign In / Providers → Email
  (senão cada jogador precisa clicar num link de e-mail para entrar).
- Deploy na Vercel + apontar Site URL/Redirect URLs de volta no Supabase.

O protótipo original continua em `C:\Users\higor\Desktop\Quadro de Missões`
(arquivo único `quadro-de-missoes.jsx` + pipeline de Artifact). Ele é referência
histórica — o produto agora é este projeto.
