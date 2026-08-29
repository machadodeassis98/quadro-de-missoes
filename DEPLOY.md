# DEPLOY.md — do zero ao ar

Guia completo: criar o projeto Supabase, rodar as migrations, ligar o Realtime,
rodar localmente e publicar na Vercel.

Nada aqui exige experiência com Postgres — é copiar, colar e conferir.

---

## Pré-requisitos

- **Node.js 20+**. Nesta máquina há uma cópia portátil em
  `%LOCALAPPDATA%\nodejs-portable\node-v24.20.0-win-x64`, já adicionada ao PATH
  do usuário. Confira com:

```bash
node -v
```

  Se der "comando não encontrado", abra um terminal novo (o PATH só vale para
  terminais abertos depois da instalação).

- Uma conta no [Supabase](https://supabase.com) (plano gratuito serve).
- Uma conta na [Vercel](https://vercel.com) para o deploy (plano gratuito serve).

---

## 1. Criar o projeto Supabase

1. Entre em <https://supabase.com/dashboard> e clique em **New project**.
2. Preencha:
   - **Name**: `quadro-de-missoes`
   - **Database password**: gere uma forte e **guarde** (é a senha do Postgres).
   - **Region**: a mais perto do grupo (`South America (São Paulo)` para o Brasil).
3. Espere o provisionamento terminar (1–2 minutos).

---

## 2. Rodar as migrations

As migrations estão em `supabase/migrations/`, numeradas. **Rode na ordem.**

No painel do Supabase: **SQL Editor** → **New query**. Para cada arquivo, cole o
conteúdo inteiro e clique em **Run**:

| Ordem | Arquivo | O que cria |
|---|---|---|
| 1 | `0001_schema.sql` | tipos, tabelas, constraints, índices e views |
| 2 | `0002_functions.sql` | funções, triggers e as RPCs (inclusive `resolve_mission`) |
| 3 | `0003_rls.sql` | Row Level Security e todas as policies |
| 4 | `0004_realtime.sql` | publicação de Realtime |
| 5 | `0005_achievements_catalog.sql` | catálogo de conquistas |

Cada um deve terminar com **Success. No rows returned**. Se algum falhar, pare e
resolva antes de seguir — os arquivos seguintes dependem dos anteriores.

> **Alternativa 1 — pelo terminal, com o script do projeto.** Pegue a
> connection string em **Project Settings → Database → Connection string →
> URI** (troque `[YOUR-PASSWORD]` pela senha do banco) e rode:
>
> ```bash
> DATABASE_URL="postgresql://postgres:SENHA@db.SEU-REF.supabase.co:5432/postgres" npm run migrate
> ```
>
> No PowerShell:
>
> ```bash
> $env:DATABASE_URL="postgresql://postgres:SENHA@db.SEU-REF.supabase.co:5432/postgres"; npm run migrate
> ```
>
> Cada arquivo roda na própria transação: se um falhar, ele é desfeito inteiro
> e o script para ali, sem deixar o banco pela metade. É repetível — rodar de
> novo não duplica nada.
>
> **Alternativa 2 — CLI do Supabase:**
> ```bash
> npx supabase link --project-ref <ref-do-projeto>
> npx supabase db push
> ```
> O `<ref-do-projeto>` é o pedaço do meio da URL do painel
> (`https://supabase.com/dashboard/project/<ref>`).

### Conferir se deu certo

No SQL Editor:

```sql
select tablename from pg_tables where schemaname = 'public' order by tablename;
```

Devem aparecer 10 tabelas: `achievements`, `character_achievements`,
`character_events`, `character_items`, `characters`, `guilds`,
`mission_participants`, `mission_rewards`, `missions`, `profiles`.

E, para conferir que a RLS está ligada em todas:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;
```

Todas devem ter `rowsecurity = true`.

---

## 3. Ligar o Realtime

A migration `0004_realtime.sql` já adiciona as tabelas à publicação
`supabase_realtime`. Confirme no painel:

**Database** → **Replication** → publicação `supabase_realtime`. Devem estar
marcadas: `missions`, `mission_participants`, `characters`, `guilds`.

Se estiverem faltando, marque na interface ou rode `0004_realtime.sql` de novo.

---

## 4. Configurar a autenticação

**Authentication** → **Sign In / Providers** → **Email**:

- **Enable Email provider**: **ligado**. É o interruptor do provedor inteiro.
- **Confirm email**: para um grupo pequeno de amigos, **desligue** — assim quem
  se cadastra entra direto, sem esperar e-mail. Se deixar ligado, cada pessoa
  precisa clicar no link do e-mail antes do primeiro login (o app avisa isso na
  tela de cadastro).

> ⚠️ São **dois interruptores diferentes** e é fácil desligar o errado. Se
> desligar o do provedor, o cadastro passa a responder "Email signups are
> disabled" — o app traduz isso e diz onde arrumar. Para conferir sem abrir o
> painel, veja `external.email` (deve ser `true`) e `mailer_autoconfirm` (deve
> ser `true` com confirmação desligada) em:
>
> `https://<projeto>.supabase.co/auth/v1/settings?apikey=<anon key>`

**Authentication** → **URL Configuration**:

- **Site URL**: `http://localhost:3000` enquanto estiver desenvolvendo; troque
  para a URL da Vercel depois do deploy.
- **Redirect URLs**: adicione as duas (local e produção).

---

## 5. Pegar as chaves

**Project Settings** → **API**:

| Campo no painel | Vai para |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Project API keys → `anon` / `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

> A `anon key` é **pública por natureza** — ela vai para o navegador de todo
> mundo. Quem protege os dados é a RLS, não o segredo da chave.
>
> **Nunca** coloque a `service_role` key no `.env.local` nem na Vercel: ela
> ignora toda a RLS e daria a qualquer visitante o poder de editar o XP de
> qualquer personagem.

---

## 6. Rodar localmente

```bash
npm install
```

Crie o arquivo `.env.local` na raiz (copie de `.env.example`) e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
```

```bash
npm run dev
```

Abra <http://localhost:3000>. Se aparecer a tela "A taverna ainda não foi
conectada ao banco de dados", o `.env.local` não foi lido — confira o nome do
arquivo e **reinicie o `npm run dev`** (variáveis de ambiente só são lidas na
inicialização).

### Primeiro teste ponta a ponta

1. Registre-se na guilda (nome, e-mail, senha).
2. **Minhas Fichas** → Nova ficha.
3. **Quadro de Missões** → Publicar missão.
4. Abra uma janela anônima, cadastre outra conta, crie uma ficha e inscreva-se.
5. Na primeira janela, aprove a inscrição — a outra janela muda para
   "✓ Confirmado" **sem refresh** (é o Realtime funcionando).
6. Resolva a missão distribuindo XP/ouro/itens.
7. Confira o histórico da ficha na segunda conta.

---

## 7. Deploy na Vercel

### 7.1 Colocar o código num repositório

```bash
git init
git add .
git commit -m "Quadro de Missões: webapp com Supabase"
```

Crie um repositório no GitHub e envie:

```bash
git remote add origin https://github.com/<voce>/quadro-de-missoes.git
git push -u origin main
```

### 7.2 Importar na Vercel

1. <https://vercel.com/new> → importe o repositório.
2. Framework: **Next.js** (detectado sozinho). Não mude build command nem
   output directory.
3. Em **Environment Variables**, adicione as duas — para **Production**,
   **Preview** e **Development**:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

4. **Deploy**.

> Se esquecer as variáveis, o build passa mas o site mostra a tela de
> configuração. Adicione as variáveis e clique em **Redeploy**.

### 7.3 Fechar o ciclo com o Supabase

Depois do deploy, volte ao Supabase → **Authentication** → **URL Configuration**
e ponha a URL da Vercel (`https://<seu-projeto>.vercel.app`) em **Site URL** e
em **Redirect URLs**. Sem isso, o link de confirmação de e-mail aponta para
`localhost`.

### 7.4 Domínio próprio (opcional)

Vercel → projeto → **Settings** → **Domains** → **Add**. Siga as instruções de
DNS. Depois **repita o passo 7.3** com o domínio novo.

---

## 8. Antes de cada deploy

```bash
npm run check
```

Roda lint, typecheck e testes de uma vez. Depois:

```bash
npm run build
```

---

## 9. Rodar os testes de integração

Os testes em `tests/integration/` exercitam o banco de verdade: limite de 3
fichas, inscrição duplicada, lotação, autorização do mestre, transação de
recompensa, XP/ouro, histórico, morte permanente e RLS. São eles que provam que
a segurança do produto é real — nenhum teste de unidade demonstra isso.

Eles precisam da `DATABASE_URL` (a mesma do passo 2) e da URL/anon key (que
saem do `.env.local` sozinhas). **Não precisam da `service_role` key**: as
contas de teste nascem direto no Postgres.

```bash
DATABASE_URL="postgresql://postgres.SEU-REF:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" npm test
```

No PowerShell:

```bash
$env:DATABASE_URL="postgresql://postgres.SEU-REF:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"; npm test
```

Sem a `DATABASE_URL`, os testes de integração **pulam sozinhos** e só os 41
testes de domínio rodam — útil em CI sem banco.

Cada execução usa e-mails com um prefixo próprio (`it<...>@quadro-integration.example.com`,
domínio reservado que nunca entrega e-mail) e apaga tudo no fim. Ainda assim,
se tiver um projeto de teste separado, prefira rodar nele.

> **Senha com caractere especial?** `#`, `?` e `@` quebram o parsing da URI.
> Codifique antes de colar: `#` → `%23`, `$` → `%24`, `?` → `%3F`, `@` → `%40`.
> Exemplo: uma senha `ab#cd$ef` vira `ab%23cd%24ef` na connection string.

---

## 10. Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Tela "A taverna ainda não foi conectada" | `.env.local` ausente ou dev server não reiniciado | Conferir o arquivo e reiniciar |
| "E-mail ou senha incorretos" logo após o cadastro | **Confirm email** ligado | Confirmar pelo e-mail ou desligar (passo 4) |
| Cadastro dá erro de permissão | `0002_functions.sql` não rodou | Rodar a migration (cria o trigger que gera o perfil) |
| Quadro vazio, sem erro | RLS sem policies | Rodar `0003_rls.sql` |
| Aviso "sem tempo real" no cabeçalho | Realtime desligado ou sem rede | Passo 3; clicar no aviso recarrega o quadro na hora |
| Mudanças só aparecem com refresh | Tabelas fora da publicação | Passo 3 |
| "row-level security" ao criar ficha | Sessão expirada | Sair e entrar de novo |
| Erro de nível/XP ao resolver | `resolve_mission` ausente | Rodar `0002_functions.sql` |
| `migrate` dá timeout | Conexão **direta** só resolve em IPv6 | Usar a URI do **Session pooler** (passo 2) |

---

## 11. Migrar os dados do protótipo (opcional)

O quadro antigo (Claude Artifact) guardava o estado em
`Quadro de Missões/build/live-state.json`. Os dados são poucos (3 personagens,
1 guilda, 1 missão) e o formato é diferente do banco novo — **recadastrar pela
interface é mais rápido e mais seguro do que escrever um importador**, e é a
recomendação. Cada jogador cria a própria conta e refaz a ficha; o mestre
republica a missão em aberto.

Não há como migrar XP/ouro "por fora": progressão só entra pela resolução de
missão. Se precisar acertar o passado, resolva uma missão simbólica com os
valores acumulados de cada personagem — assim o histórico também fica coerente.
