# Quadro de Missões

Quadro de missões de RPG de mesa (D&D 5e) para um grupo de amigos **sem grupo
fixo**. Qualquer jogador publica uma missão e vira o mestre dela; os outros
inscrevem uma das suas fichas; o mestre aprova quem entra e, no fim da sessão,
distribui XP, ouro e itens **individualmente**, por personagem.

Cada jogador mantém até **3 fichas ativas**, independentes entre si. Só o
personagem que jogou aquela missão evolui.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Linguagem | TypeScript (strict) |
| Estilo | Tailwind CSS v4 |
| Ícones | lucide-react |
| Banco | Supabase / PostgreSQL |
| Autenticação | Supabase Auth (e-mail + senha) |
| Tempo real | Supabase Realtime (postgres_changes) |
| Autorização | Row Level Security + funções RPC `SECURITY DEFINER` |
| Testes | Vitest |
| Deploy | Vercel |

---

## Começar

```bash
npm install
```

Copie `.env.example` para `.env.local` e preencha com as chaves do seu projeto
Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
```

```bash
npm run dev
```

**O banco precisa existir antes.** O passo a passo completo — criar o projeto,
rodar as migrations, ligar o Realtime, publicar na Vercel — está em
[DEPLOY.md](DEPLOY.md). Sem as variáveis, o app sobe e mostra uma tela
explicando o que falta configurar.

---

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento em <http://localhost:3000> |
| `npm run build` | Build de produção |
| `npm start` | Roda o build de produção |
| `npm run lint` | ESLint (inclui as regras do React Compiler) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Testes (os de integração pulam sem `DATABASE_URL`) |
| `npm run check` | lint + typecheck + testes |
| `npm run migrate` | Aplica as migrations (precisa de `DATABASE_URL`) |

---

## Estrutura

```
src/
├── app/
│   ├── (app)/                 rotas protegidas (exigem sessão)
│   │   ├── layout.tsx         confere a sessão, monta o BoardProvider
│   │   ├── quadro/            Quadro de Missões
│   │   ├── fichas/            Minhas Fichas
│   │   ├── guildas/           Guildas
│   │   └── mural/             Mural de Conquistas
│   ├── entrar/                autenticação (Server Actions)
│   ├── layout.tsx             fontes e tokens globais
│   └── globals.css            design tokens da taverna
├── components/
│   ├── ui/                    primitivas (botão de latão, modal, selo...)
│   ├── characters/            carteirinha, criação, histórico
│   └── missions/              card, publicação, inscrição, painel do mestre, resolução
├── lib/
│   ├── domain/                regras puras (nível, rank, título, conquistas)
│   ├── data/                  camada de acesso a dados + estado/realtime
│   ├── supabase/              clientes de navegador e servidor
│   └── types/                 tipos das tabelas
└── proxy.ts                   renova a sessão e protege as rotas

supabase/migrations/           schema, funções, RLS, realtime, catálogo
tests/                         unitários (domínio) e de integração (banco)
```

### Onde mora cada coisa

- **Regra de negócio pura** (tabela de nível, sugestão de rank, título por
  reputação, conquistas derivadas) → `src/lib/domain/`. Sem React, sem I/O,
  testada por unidade.
- **Toda query e mutação** → `src/lib/data/api.ts`. Nenhum componente fala com
  o Supabase direto.
- **Estado + tempo real** → `src/lib/data/board-provider.tsx`. Um canal de
  Realtime para o app inteiro.
- **Regra que precisa ser garantida** → `supabase/migrations/0002_functions.sql`
  e `0003_rls.sql`. O frontend nunca é a única barreira.

---

## Regras do quadro

Estas foram validadas com o grupo e estão reforçadas no banco:

- **3 fichas ativas** por jogador. Arquivar libera espaço **sem apagar o
  histórico**; a ficha pode voltar depois.
- A ficha é uma **carteirinha** — resumo de mesa. A ficha 5e completa vive no
  **Roll20** (campo de link). Atributos, PV e CA são números manuais: nada é
  derivado de raça ou classe.
- **XP, ouro, reputação, nível e status não são editáveis pelo jogador.** Só
  entram pela resolução da missão, feita pelo mestre. Isso é garantido por
  trigger no banco — não só pela interface.
- **Nível é 100% derivado do XP** (tabela 5e, teto no 20).
- **Rank F/D/C/B/A/S** traz uma *sugestão* de XP/ouro/reputação que pré-preenche
  o formulário de resolução. O mestre altera tudo, por jogador. Rank nunca
  credita nada sozinho.
- **Nível sugerido é indicativo** e nunca bloqueia inscrição.
- **Uma ficha por jogador por missão.**
- **Morte é permanente**: quem cai não recebe nada e a ficha não volta ao quadro.
- **Reputação** é separada do XP. O **título** (Novato → Aventureiro →
  Aventureiro Renomado → Veterano → Campeão → Lenda da Guilda) é derivado da
  faixa de reputação.
- **Reputação da guilda nunca é editável** — é a soma da reputação dos membros.
- **Conquistas são derivadas do histórico**, nunca concedidas à mão.

---

## Testes

```bash
npm test
```

- **41 testes de domínio** (`tests/domain/`) — regras puras: tabela de nível,
  ranks, títulos, limite de fichas, conquistas derivadas. Rodam sempre.
- **20 testes de integração** (`tests/integration/`) — rodam contra um Supabase
  de verdade, pelo mesmo caminho do navegador (supabase-js → PostgREST → RLS /
  trigger / RPC). Cobrem limite de 3 fichas, arquivamento preservando histórico,
  progressão intocável pelo jogador, inscrição duplicada, uma ficha por jogador
  por missão, lotação, autorização do mestre, resolução transacional, morte
  permanente, tabelas que só as RPCs escrevem e reputação de guilda.

Os de integração precisam da `DATABASE_URL` (ver [DEPLOY.md](DEPLOY.md), seção 9)
e **pulam sozinhos** sem ela. Não precisam da `service_role` key.

## Segurança

- **RLS ligada em todas as 10 tabelas.**
- `mission_rewards`, `character_events` e `character_achievements` **não têm
  policy de escrita**: só as funções `SECURITY DEFINER` gravam nelas.
- Aprovar, recusar, inscrever e resolver passam por **RPC**, que confere quem
  está chamando antes de agir.
- A resolução de missão é **uma transação só**: recompensa, XP, ouro, itens,
  histórico, participação e missão concluída, ou tudo, ou nada.
- A `anon key` é pública por natureza; a `service_role` key **nunca** entra no
  frontend nem no deploy.

---

## Histórico do projeto

Este app substitui um protótipo de arquivo único (React compilado no navegador,
publicado como Claude Artifact) que guardava tudo num storage chave-valor sem
autenticação nem transações. A auditoria daquele protótipo, os problemas
encontrados e as decisões de arquitetura estão em
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

O design — fundo de taverna, pergaminho, latão, Cinzel/Spectral/JetBrains Mono,
selo de rank — foi portado do protótipo com os mesmos valores hexadecimais.
