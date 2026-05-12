# Murmur — Projeto Pessoal

Aplicação web de notas pessoais com gravação de áudio, transcrição local automática e análise de conteúdo para personalização de respostas.

O nome **Murmur** vem da ideia de que tudo o que você "murmura" pra si mesmo — ideias soltas, lembretes, fluxo de consciência — é capturado, transcrito e organizado por IA.

---

## Visão Geral

Aplicação web do tipo "notas pessoais", mas altamente personalizada para o usuário (calazans95@hotmail.com).
A diferença para um app de notas comum:

1. **Gravação de áudio nativa** dentro da aplicação.
2. **Transcrição automática local** com `faster-whisper` (sem custo por chamada, roda na máquina).
3. **Análise semântica** do conteúdo transcrito para entender o usuário e personalizar respostas/recomendações ao longo do tempo, através de uma **camada LLM plugável** (Anthropic hoje, mas qualquer modelo pode ser plugado depois).
4. **Sistema de autenticação + permissões** desde o dia 1 (mesmo sendo pessoal, prepara o terreno para múltiplos usuários / convidados / acesso compartilhado de notas específicas).

---

## Stack Técnico

### Monorepo (raiz)
- **npm workspaces** para os pacotes JS (`apps/web`, `packages/*`).
- O backend Python (`apps/api`) vive no mesmo repo mas tem seu próprio ciclo de dependências via `pyproject.toml`.
- **Backend roda em Docker** (Postgres + API), **frontend roda no host** (Vite dev server).
- **Scripts unificados** na raiz (`npm run dev:web` no host, `npm run dev:api` sobe o container).
- **Repositório:** `git@github.com:LucasCalazans/murmur.git` (monorepo único — web e api versionados juntos).

### Frontend — `apps/web` (React)
- **React 18** + **TypeScript** + **Vite**
- **TailwindCSS** para estilização
- **React Router** para navegação
- **TanStack Query** para estado de servidor
- **React Hook Form** + **Zod** para formulários validados
- **Axios** para chamadas HTTP
- **MediaRecorder API** (nativa do browser) para gravação de áudio
- **lucide-react** para ícones
- **sonner** para toasts

### Backend — `apps/api` (Python / FastAPI)
- **FastAPI** + **Uvicorn**
- **Pydantic v2** + **pydantic-settings** para config tipada
- **SQLModel** (SQLAlchemy + Pydantic) para modelos
- **Alembic** para migrations
- **PostgreSQL 16** (rodando via Docker Compose em dev)
- **asyncpg** (driver async runtime) + **psycopg[binary]** (driver síncrono p/ Alembic)
- **passlib[bcrypt]** para hash de senha
- **PyJWT** para emissão e validação de tokens
- **LiteLLM** como base da camada LLM plugável (segue padrão do `prism`)
- **faster-whisper** + **ffmpeg-python** para transcrição local
- **loguru** para logging, **orjson** para serialização

### Por que essa stack?
- **Backend em Python** porque (a) `faster-whisper` é Python nativo — sem ponte IPC, sem subprocess; (b) a camada LLM que vou replicar do `prism` já é Python (LiteLLM); (c) o ecossistema de ML/áudio em Python é incomparavelmente mais maduro.
- **SQLModel + Alembic + asyncpg** — exato stack do `prism`. Migração de conhecimento direta.
- **LiteLLM** desacopla provider — trocar Anthropic por OpenAI / Gemini / Ollama é flag, não refactor.
- **faster-whisper** local — zero custo recorrente, latência baixa, e funciona offline. Roda em CPU; com GPU CUDA fica multi-x mais rápido.
- **Monorepo polyglota** (Node + Python no mesmo repo) — mantém web e api versionados juntos sem amarrar tooling.

---

## Estrutura de Pastas

```
murmur/
├── CLAUDE.md                      # Este arquivo — roadmap e contexto vivo
├── package.json                   # Workspaces JS + scripts unificados
├── docker-compose.yml             # Postgres em dev
├── .gitignore
├── .env.example                   # (a criar) variáveis compartilhadas
│
├── apps/
│   ├── web/                       # Frontend React
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── components/
│   │       │   ├── ui/              # Button, Input, Card, Dialog...
│   │       │   ├── auth/            # LoginForm, ProtectedRoute
│   │       │   ├── notes/           # NoteList, NoteEditor
│   │       │   ├── audio/           # AudioRecorder, AudioPlayer, TranscriptViewer
│   │       │   └── layout/          # Sidebar, Topbar, AppShell
│   │       ├── pages/               # Login, Register, Dashboard, NoteDetail, Settings
│   │       ├── routes/              # Configuração de rotas + guards
│   │       ├── hooks/               # useAuth, useNotes, useRecorder, useTranscribe
│   │       ├── lib/                 # api.ts (axios), utils.ts
│   │       ├── contexts/            # AuthContext
│   │       ├── types/               # Tipos gerados/compartilhados
│   │       └── styles/              # globals.css
│   │
│   └── api/                       # Backend FastAPI (Python)
│       ├── pyproject.toml
│       ├── alembic.ini             # (a criar)
│       ├── .env.example            # (a criar)
│       ├── migrations/             # Migrations geradas pelo Alembic
│       └── src/
│           ├── main.py             # Bootstrap FastAPI
│           ├── core/               # config.py (settings), security.py, logging.py
│           ├── api/
│           │   ├── deps.py         # Dependências (get_db, get_current_user)
│           │   └── routes/         # auth.py, notes.py, audio.py, transcripts.py
│           ├── db/
│           │   ├── session.py      # AsyncEngine + AsyncSession factory
│           │   └── models/         # user.py, note.py, audio.py, transcript.py, analysis.py
│           ├── schemas/            # Pydantic schemas (request/response)
│           ├── middleware/         # auth.py, error_handler.py
│           ├── services/
│           │   ├── llm/            # ★ Camada LLM plugável (ver abaixo)
│           │   │   ├── __init__.py
│           │   │   ├── client.py   # LLMClient + complete()
│           │   │   ├── config.py   # SUPPORTED_PROVIDERS, resolve_model
│           │   │   └── exceptions.py
│           │   ├── transcription/  # faster-whisper wrapper
│           │   └── analysis/       # Pipeline: transcript → análise via LLM
│           │   # (auth/ vazio — Clerk SDK em core/security.py cobre tudo)
│           └── utils/              # helpers diversos
│
└── packages/
    └── shared-types/               # (futuro) tipos TS gerados do OpenAPI da API
```

---

## ★ Camada LLM Plugável

Replicação direta do padrão de `~/projects/prism/backend/src/services/llm`:

- **`LLMClient.complete(...)`** — único entrypoint usado pelos call sites.
- **`SUPPORTED_PROVIDERS = ("anthropic", "openai", "ollama")`** — whitelist; provider inválido falha no boot.
- **`LLMResponse`** normalizado: `text`, `model`, `usage` (input/output/cache tokens), `raw`.
- **`LLMUsage`** com breakdown de tokens (input, output, cache_read, cache_write).
- Exceções próprias: `LLMError`, `LLMConfigError`, `LLMRateLimitError`, `LLMOverloadedError`.
- **System blocks com cache hints**: aceita `[{"text": "...", "cache": "ephemeral"}]` e traduz para o formato do provider.
- **Validação no boot**: `validate_llm_config(settings)` checa chave de API + modelo configurado.
- **Singleton**: `llm_client` exportado pelo `__init__.py`.

Trocar de provider = mudar a env `LLM_PROVIDER` e ter a chave correspondente. Nenhuma linha de código de call site muda.

Referência canônica: `~/projects/prism/backend/src/services/llm/client.py`.

---

## Modelo de Permissões (proposta inicial)

Três níveis, definidos em `users.role`:

| Role     | Descrição                                                         |
|----------|-------------------------------------------------------------------|
| `owner`  | Eu — acesso total, gerencia usuários, vê todas as notas           |
| `editor` | Pode criar e editar suas próprias notas                           |
| `viewer` | Apenas leitura de notas compartilhadas explicitamente             |

Notas têm `owner_id` e podem ser compartilhadas via tabela `note_shares (note_id, user_id, permission)`.
Dependência `requires_role(...)` valida em cada rota.

---

## Workflow de Desenvolvimento

**Backend roda 100% em Docker. Frontend roda no host (Node nativo).**

```bash
# 1. Subir backend (postgres + api) — primeira vez puxa imagens e builda
npm run up
# ou só a api (postgres sobe como dependência):
npm run dev:api          # foreground, com logs
npm run dev:api:detach   # background

# 2. Rodar migrations (dentro do container)
npm run db:migrate

# 3. Frontend no host
npm install              # instala deps do workspace web
npm run dev:web          # Vite em http://localhost:5173

# Inspeção
npm run logs:api         # tail dos logs da api
npm run shell:api        # bash dentro do container
npm run db:psql          # psql no Postgres
npm run ps               # status dos containers

# Parar tudo
npm run down
```

**Hot reload:** o código do `apps/api/src/` é bind-mountado dentro do container. Salvar um `.py` no host dispara o `uvicorn --reload` lá dentro.

**Modelos do faster-whisper:** baixados na primeira transcrição e cacheados no volume nomeado `whisper_models` — não some entre `docker compose down/up`.

**Áudios gravados:** persistidos em `apps/api/storage/audio/` no host (bind mount), inspecionáveis fora do container.

---

## Roadmap

### Fase 0 — Estrutura inicial ✅ (concluída e pushada em 2026-05-12)
- [x] Estrutura monorepo (`apps/web`, `apps/api`, `packages/`)
- [x] `docker-compose.yml` com **postgres + api** (backend em Docker, frontend no host)
- [x] `apps/api/Dockerfile` (multi-stage: base → deps → dev / prod)
- [x] `apps/api/.dockerignore`
- [x] `package.json` raiz com workspaces e scripts unificados (`dev:api`, `db:migrate`, `logs:api`, `shell:api` etc.)
- [x] `apps/web/package.json` (deps frontend)
- [x] `apps/api/pyproject.toml` (deps backend)
- [x] `.env.example` na raiz (consumido pelo docker-compose)
- [x] `.gitignore` ajustado (Python + node + storage local; `models/` agora é `/models/` para não conflitar com `apps/api/src/db/models/`)
- [x] **Nome do projeto definido: Murmur**
- [x] **Pasta local renomeada** para `murmur/`
- [x] `git init` + branch `main` + `git remote add origin git@github.com:LucasCalazans/murmur.git`
- [x] Configs do frontend: `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/globals.css`, `src/vite-env.d.ts`, `.eslintrc.cjs`, `.env.example`
- [x] Configs do backend: `alembic.ini`, `migrations/env.py`, `migrations/script.py.mako`, `apps/api/.env.example`, `src/main.py` (FastAPI + `/health`)
- [x] `__init__.py` em toda árvore de pacotes Python
- [x] Build inicial: `docker compose build api` + `npm install`
- [x] Smoke test: `curl http://localhost:3001/health` → `{"status":"ok","service":"murmur-api","env":"development"}`
- [x] Typecheck do frontend (`tsc --noEmit`) passa
- [x] Primeiro commit + push: `feat: bootstrap monorepo murmur (web + api docker)` (54 arquivos, root-commit)

### Fase 1 — Auth via Clerk ⏳ (em andamento — esperando o usuário criar o app na Clerk)
**Decisão (2026-05-12):** auth gerenciada pela Clerk em vez de implementação própria. Razão: o usuário não quer lidar com segurança em produção. Free tier (Hobby) cobre o uso pessoal com folga (50k MRU/app, apps ilimitadas).

Implementação:
- [x] `core/config.py` (Settings com pydantic-settings — Clerk, DB, LLM, Whisper)
- [x] `core/security.py` (`authenticate()` via `clerk_backend_api.authenticate_request_async`)
- [x] `db/session.py` (AsyncEngine + sessionmaker)
- [x] `db/models/user.py` (`User`: id, clerk_user_id UNIQUE, email, role, ts; enum `UserRole`)
- [x] `migrations/env.py` puxa `SQLModel.metadata`; `script.py.mako` agora inclui `import sqlmodel`
- [x] Migration `5759fdf77f11_init_users` aplicada (tabela `users` + índices)
- [x] `api/deps.py` (`get_db`, `get_clerk_identity`, `get_current_user` com lazy-upsert, `require_role(*roles)`)
- [x] `api/routes/auth.py` (`GET /auth/me`)
- [x] `main.py` plugando router e validando config no boot
- [x] Frontend: `@clerk/clerk-react` instalado; `<ClerkProvider>` em `main.tsx`; rotas `/sign-in` e `/sign-up`; `<UserButton>` no header; `useApi()` hook em `lib/api.ts` que injeta Bearer JWT
- [ ] **Usuário precisa criar app na Clerk e preencher chaves** (passos detalhados em "Próximo chat" abaixo)
- [ ] Smoke test ponta a ponta: signup pela UI → `/auth/me` retorna `User` com role correta
- [ ] Webhook `user.deleted` (sync) — adiar pra Fase 1.1 (precisa de túnel pra dev)

### Fase 2 — Camada LLM
- [ ] Portar `services/llm/{client,config,exceptions}.py` do prism
- [ ] Validação no startup do FastAPI
- [ ] Smoke test: `POST /debug/llm` (apenas em dev) para validar configuração

### Fase 3 — Frontend: shell + app
*(Auth UI já entrou na Fase 1 via `@clerk/clerk-react` — `<SignIn/>`, `<SignUp/>`, `<UserButton/>`).*
- [ ] Componentes UI primitivos (Button, Input, Card, Dialog) na pasta `components/ui/`
- [ ] Layout autenticado (sidebar + topbar) — usar `<SignedIn>` e `useUser()` da Clerk pra exibir info
- [ ] `ProtectedRoute` baseado em `<SignedIn/>` (redireciona pra `/sign-in` se não logado)
- [ ] Página Dashboard (placeholder) com link pras notas (Fase 4)

### Fase 4 — Notas (CRUD)
- [ ] Modelo `Note` (id, owner_id, title, content, tags, timestamps)
- [ ] Endpoints REST `/notes`
- [ ] Frontend: lista + editor (textarea, markdown depois)
- [ ] Busca simples (`ILIKE`)

### Fase 5 — Gravação de áudio
- [ ] `AudioRecorder` (MediaRecorder + canvas waveform + timer)
- [ ] Upload via `POST /audio` (multipart)
- [ ] Armazenamento em `apps/api/storage/audio/{user_id}/{audio_id}.{ext}`
- [ ] Modelo `AudioRecording` (id, user_id, note_id?, file_path, duration, mime_type, ts)
- [ ] `AudioPlayer` no frontend

### Fase 6 — Transcrição local (faster-whisper)
- [ ] `services/transcription/whisper.py` wrapper
- [ ] Config: model size (`tiny`/`base`/`small`/`medium`/`large-v3`), device (`cpu`/`cuda`), compute_type
- [ ] Endpoint `POST /audio/{id}/transcribe` (executa em BackgroundTask)
- [ ] Modelo `Transcript` (id, audio_id, text, segments JSON, language, model, ts)
- [ ] Frontend: indicador de progresso + exibição da transcrição
- [ ] Edição manual da transcrição (correção humana)

### Fase 7 — Análise semântica e personalização
- [ ] `services/analysis/pipeline.py` usando `llm_client.complete(...)`
- [ ] Extrai: resumo, tópicos, action items, sentimento, entidades
- [ ] Modelo `Analysis` (id, transcript_id, summary, topics, action_items, sentiment, ts)
- [ ] **Perfil do usuário** acumulado: `UserProfile` com interesses, padrões, decisões — atualizado a cada nova análise
- [ ] UI estilo chat onde a aplicação responde levando em conta o perfil

### Fase 8+ — Parking lot
- Tags automáticas via análise
- Busca semântica (embeddings + `pgvector`)
- PWA + atalho global pra iniciar gravação
- Export markdown / PDF
- Compartilhamento via link público
- App mobile (Tauri ou React Native)
- Modo offline com sync

---

## Variáveis de Ambiente

Veja os arquivos `.env.example` para a lista completa. Os essenciais para subir o dev:

### Raiz (`.env` — lido pelo docker-compose)
- `POSTGRES_{USER,PASSWORD,DB,PORT}` (port `5433` no host)
- `CLERK_SECRET_KEY` + `CLERK_PUBLISHABLE_KEY` + `CLERK_AUTHORIZED_PARTIES`
- `OWNER_EMAIL` (default `calazans95@hotmail.com` — promovido a `role=owner` no primeiro login)
- `ANTHROPIC_API_KEY` (Fase 2+)
- `WHISPER_*` (Fase 6+)

### `apps/web/.env.local`
- `VITE_API_URL=http://localhost:3001`
- `VITE_CLERK_PUBLISHABLE_KEY=pk_test_...`

---

## Convenções

- **Idioma:** comentários e UI em **português**. Identificadores de código em **inglês**.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`...).
- **Python:** `ruff` (lint + format), tipos com Pydantic v2, async em tudo que toca I/O.
- **TS:** `strict: true`, sem `any` livre.
- **Erros da API:** sempre JSON `{ "error": { "code": "...", "message": "..." } }` com status HTTP correto.
- **Validação:** Pydantic na API, Zod no web — formato dos erros padronizado.

---

## Estado Atual

- **Última atualização:** 2026-05-12
- **Nome do projeto:** **Murmur**
- **Repo remoto:** `git@github.com:LucasCalazans/murmur.git` — `main` pushada.
- **Fase ativa:** Fase 1 (auth via Clerk) — código todo escrito; falta o usuário criar a app na Clerk, preencher as chaves no `.env` e fazer o smoke test ponta a ponta.
- **Decisão de auth (2026-05-12):** Clerk (SaaS). Razão: usuário não quer lidar com segurança em produção. Free tier cobre o uso (50k MRU/app, apps ilimitadas).
- **Portas em uso no host (dev):**
  - `5173` — Vite (frontend)
  - `3001` — FastAPI (no container `murmur-api`)
  - `5433` — Postgres (no container `murmur-postgres`) — `5432` está ocupado por outro container, por isso o host port foi remapeado.

### O que foi feito nesta sessão (Fase 1)
1. **Decisão Clerk** após comparar com FastAPI-Users e build próprio; memória salva em `~/.claude/projects/-home-calazans-projects-murmur/memory/user_auth_preference.md`.
2. **Backend:**
   - `pyproject.toml`: trocado `passlib[bcrypt]` + `pyjwt[crypto]` por `clerk-backend-api>=5.0.0` + `svix>=1.30.0`. Imagem rebuilded.
   - `src/core/config.py`: `Settings` pydantic-settings tipado (Clerk, DB, LLM, Whisper). `validate_clerk_config()` falha em prod sem chaves.
   - `src/core/security.py`: função `authenticate(request)` async que chama `authenticate_request_async` do SDK Clerk. Retorna `ClerkIdentity` (clerk_user_id, session_id, email, raw_payload). 503 se chave ausente, 401 se token inválido.
   - `src/db/session.py`: `AsyncEngine` + `async_sessionmaker` lendo `settings.database_url`.
   - `src/db/models/user.py`: `User` (id UUID, clerk_user_id UNIQUE, email, role enum, created_at, updated_at). `UserRole` enum (`owner`/`editor`/`viewer`).
   - `src/db/models/__init__.py`: re-exporta `User`, `UserRole`.
   - `migrations/env.py`: importa `src.db.models` e aponta `target_metadata = SQLModel.metadata`.
   - `migrations/script.py.mako`: incluído `import sqlmodel` (alembic não inclui sozinho).
   - Migration `5759fdf77f11_init_users` gerada + aplicada (tabela `users` + 2 índices).
   - `src/api/deps.py`: `get_db`, `get_clerk_identity`, `get_current_user` (com lazy-upsert da `User` row + promoção do `OWNER_EMAIL` a `owner`), `require_role(*roles)`.
   - `src/schemas/user.py`: `UserOut` Pydantic.
   - `src/api/routes/auth.py`: `GET /auth/me` — protegido por `get_current_user`.
   - `src/main.py`: pluga router e roda `validate_clerk_config()` no boot.
3. **Frontend:**
   - `@clerk/clerk-react@^5.61.6` instalado.
   - `src/main.tsx`: `<ClerkProvider>` com tema dark (verde Murmur) envolvendo tudo. Falha clara se `VITE_CLERK_PUBLISHABLE_KEY` ausente.
   - `src/lib/api.ts`: hook `useApi()` que retorna axios com interceptor de `Authorization: Bearer <Clerk JWT>`.
   - `src/App.tsx`: rotas `/sign-in/*`, `/sign-up/*` com componentes da Clerk; home mostra `<UserButton/>` e card chamando `/auth/me`. `<SignedIn>` / `<SignedOut>` controlam o que aparece.
   - `src/vite-env.d.ts`: tipa `VITE_CLERK_PUBLISHABLE_KEY`.
4. **Env files atualizados:** `.env.example` (raiz e `apps/api/`) e `apps/web/.env.example` com vars da Clerk. `docker-compose.yml`: removidas vars JWT_*, adicionadas `CLERK_*` e `OWNER_EMAIL`.
5. **Smoke test backend isolado:** `GET /auth/me` sem chave → 503 com mensagem `clerk_not_configured` clara. Quando a chave estiver no `.env`, 401 (sem token) ou 200 (com token válido).

### 🎯 Próximo chat — comece exatamente daqui

A integração Clerk está toda escrita. O bloqueio é criar a app na Clerk e plugar as chaves. Passos pro usuário:

**1. Criar app na Clerk:**
   1. Abrir https://dashboard.clerk.com.
   2. "Create application" → nome `Murmur` → escolher providers (Email + Google é o mínimo recomendado).
   3. Em "API keys": copiar `Publishable key` (pk_test_…) e `Secret key` (sk_test_…).

**2. Plugar as chaves:**
   - Em `~/projects/murmur/.env` (raiz) preencher: `CLERK_SECRET_KEY=` e `CLERK_PUBLISHABLE_KEY=`. Deixar `CLERK_AUTHORIZED_PARTIES=http://localhost:5173` e `OWNER_EMAIL=calazans95@hotmail.com`.
   - Criar `~/projects/murmur/apps/web/.env.local` com:
     ```
     VITE_API_URL=http://localhost:3001
     VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
     ```

**3. Reiniciar stack:**
   ```bash
   cd ~/projects/murmur
   docker compose up -d        # api recarrega .env automaticamente
   npm run dev:web              # Vite na porta 5173
   ```

**4. Smoke test ponta a ponta:**
   - Abrir http://localhost:5173 → clicar "sign-in" → criar conta com `calazans95@hotmail.com`.
   - Após login, voltar pra `/` — o card "seu usuário" deve mostrar o JSON com `role: "owner"`.
   - Se aparecer `role: "editor"`: o token da Clerk não traz email no claim padrão. Solução: dashboard Clerk → JWT Templates → Customize "session" token → adicionar claim `email: {{user.primary_email_address}}` e tentar de novo. Alternativa: rodar uma query manual `UPDATE users SET role='owner' WHERE email='calazans95@hotmail.com';`.

**5. Quando isso passar → Fase 2 (Camada LLM):**
   - Abrir `~/projects/prism/backend/src/services/llm/{__init__,client,config,exceptions}.py` e portar **mantendo o padrão** (singleton `llm_client`, `LLMClient.complete()`, `SUPPORTED_PROVIDERS`, exceções próprias, validação no boot). NÃO reescrever do zero.
   - Endpoint `POST /debug/llm` em dev pra smoke test.

### ⚠️ Avisos para o próximo chat
- **Auth = Clerk.** Não sugerir build próprio nem self-hosted. Memória do usuário em `~/.claude/projects/-home-calazans-projects-murmur/memory/`.
- **Não rodar `pip install` no host** — backend em Docker. Deps Python via `pyproject.toml` + rebuild da imagem.
- **`npm install` na raiz** — instala só o workspace `apps/web`.
- **Postgres no host:** `localhost:5433`. Dentro do compose: `postgres:5432`.
- **SDK Clerk Python:** `clerk-backend-api` v5+. Função canônica: `authenticate_request_async(request, AuthenticateRequestOptions(secret_key=..., authorized_parties=[...]))`. Aceita qualquer objeto com `.headers` — FastAPI Request serve.
- **Migrations:** Alembic autogen NÃO inclui `import sqlmodel` por padrão. O `script.py.mako` já foi ajustado pra incluir.
- **Modelo Anthropic padrão:** `claude-sonnet-4-6` (cutoff Jan/2026).
- **Hot reload do backend:** bind mount do `apps/api/src/`. Mudanças em `pyproject.toml` precisam de `docker compose build api`.
- **eslint v8 EOL:** considerar upgrade v9+ depois.
