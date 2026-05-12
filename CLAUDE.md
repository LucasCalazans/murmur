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
│           │   ├── analysis/       # Pipeline: transcript → análise via LLM
│           │   └── auth/           # Lógica de auth (hash, JWT, sessões)
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

### Fase 0 — Estrutura inicial ⏳ (em andamento)
- [x] Estrutura monorepo (`apps/web`, `apps/api`, `packages/`)
- [x] `docker-compose.yml` com **postgres + api** (backend em Docker, frontend no host)
- [x] `apps/api/Dockerfile` (multi-stage: base → deps → dev / prod)
- [x] `apps/api/.dockerignore`
- [x] `package.json` raiz com workspaces e scripts unificados (`dev:api`, `db:migrate`, `logs:api`, `shell:api` etc.)
- [x] `apps/web/package.json` (deps frontend — aguardando aprovação final)
- [x] `apps/api/pyproject.toml` (deps backend — aguardando aprovação final)
- [x] `.env.example` na raiz (consumido pelo docker-compose)
- [x] `.gitignore` ajustado (Python + node + storage local)
- [x] **Nome do projeto definido: Murmur** (renomeado de "audio-to-notes" em tudo)
- [x] CLAUDE.md atualizado com workflow Docker
- [ ] **Renomear pasta local** `audio-to-notes/` → `murmur/` *(usuário vai fazer manualmente)*
- [ ] Aprovação final das dependências
- [ ] `git init` + `git remote add origin git@github.com:LucasCalazans/murmur.git` + primeiro commit
- [ ] Configs faltando:
  - `apps/web/`: `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/globals.css`, `apps/web/.env.example`
  - `apps/api/`: `alembic.ini`, `apps/api/.env.example`, `src/main.py` mínimo (FastAPI + `/health`)
  - Raiz: `tsconfig.base.json` (opcional, p/ shared-types depois)
- [ ] Build inicial: `docker compose build api` + `npm install`
- [ ] Smoke test: `docker compose up -d` → curl `http://localhost:3001/health` → 200 OK

### Fase 1 — Backend: bootstrap + auth
- [ ] `main.py` (FastAPI app + CORS + error handlers)
- [ ] `core/config.py` (Settings com pydantic-settings)
- [ ] `db/session.py` + Alembic configurado
- [ ] Modelos: `User`, `RefreshToken`, `NoteShare`
- [ ] Migration inicial
- [ ] Endpoints: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`
- [ ] Deps: `get_current_user`, `require_role(*roles)`
- [ ] Seed: criar usuário `owner` (eu)

### Fase 2 — Camada LLM
- [ ] Portar `services/llm/{client,config,exceptions}.py` do prism
- [ ] Validação no startup do FastAPI
- [ ] Smoke test: `POST /debug/llm` (apenas em dev) para validar configuração

### Fase 3 — Frontend: shell + auth
- [ ] Setup Vite + Tailwind + React Router
- [ ] Componentes UI primitivos
- [ ] `AuthContext` + hook `useAuth`
- [ ] Páginas Login/Register
- [ ] `ProtectedRoute`
- [ ] Layout (sidebar + topbar) com info do usuário e logout

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

### Raiz (`.env` — opcional, lido pelo docker-compose)
```
POSTGRES_USER=murmur
POSTGRES_PASSWORD=murmur_dev
POSTGRES_DB=murmur
POSTGRES_PORT=5432
```

### `apps/api/.env`
```
# App
APP_ENV=development
APP_PORT=3001
CORS_ORIGIN=http://localhost:5173

# Banco
DATABASE_URL=postgresql+asyncpg://murmur:murmur_dev@localhost:5432/murmur
DATABASE_URL_SYNC=postgresql+psycopg://murmur:murmur_dev@localhost:5432/murmur

# Auth
JWT_SECRET=<gerar com `openssl rand -hex 32`>
JWT_ALGORITHM=HS256
JWT_ACCESS_TTL_MIN=15
JWT_REFRESH_TTL_DAYS=7

# LLM (plugável)
LLM_PROVIDER=anthropic                    # anthropic | openai | ollama
LLM_MODEL=claude-sonnet-4-6                # ou gpt-4o-mini, llama3.1:8b, etc.
ANTHROPIC_API_KEY=<sua chave>
OPENAI_API_KEY=<opcional>
OLLAMA_BASE_URL=http://localhost:11434     # se usar Ollama
OLLAMA_MODEL=llama3.1:8b

# Transcrição (faster-whisper)
WHISPER_MODEL_SIZE=base                    # tiny|base|small|medium|large-v3
WHISPER_DEVICE=cpu                         # cpu|cuda
WHISPER_COMPUTE_TYPE=int8                  # int8|float16|float32
WHISPER_LANGUAGE=pt                        # ou auto

# Armazenamento
AUDIO_STORAGE_PATH=./storage/audio
MAX_AUDIO_SIZE_MB=100
```

### `apps/web/.env`
```
VITE_API_URL=http://localhost:3001
```

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
- **Repo remoto:** `git@github.com:LucasCalazans/murmur.git` (ainda não conectado localmente — `git init` pendente)
- **Fase ativa:** Fase 0 — Estrutura inicial

### O que já foi feito nesta sessão
1. Estrutura monorepo criada (`apps/web`, `apps/api`, `packages/shared-types`).
2. Backend definido em **Python/FastAPI** (alinhado com prism) rodando em **Docker**; frontend **React/Vite** no host.
3. Banco trocado pra **Postgres 16** via docker-compose.
4. Transcrição definida com **faster-whisper** (local, sem custo de API).
5. **Camada LLM plugável** especificada — vai ser portada de `~/projects/prism/backend/src/services/llm/`.
6. Dockerfile multi-stage do backend (`base → deps → dev/prod`) com ffmpeg + libgomp1.
7. docker-compose com **postgres + api** numa network `murmur`, volumes pra storage e cache de modelos.
8. Scripts unificados na raiz (`npm run dev:api`, `npm run dev:web`, `npm run db:migrate`, etc.).
9. Todos os nomes renomeados de "audio-to-notes" pra "murmur" em 5 arquivos.

### 🎯 Próximo chat — comece exatamente daqui

**1. Confirmar que o rename da pasta foi feito.**
   - Pasta local agora deve ser `~/projects/murmur/` (o usuário ia fazer `mv` manualmente).
   - Se ainda estiver em `audio-to-notes/`, confirmar com o usuário antes de prosseguir.

**2. Inicializar git e conectar ao remote:**
   ```bash
   cd ~/projects/murmur
   git init
   git branch -M main
   git remote add origin git@github.com:LucasCalazans/murmur.git
   ```
   *(NÃO commitar ainda — falta criar os configs e o `main.py` mínimo pra que o primeiro commit já tenha um backend funcional.)*

**3. Validar deps com o usuário** (uma última vez antes de buildar):
   - `apps/web/package.json` — stack React/Vite/Tailwind/RHF/Zod
   - `apps/api/pyproject.toml` — FastAPI/SQLModel/asyncpg/LiteLLM/faster-whisper

**4. Criar configs faltando** (lista completa no checklist da Fase 0 acima). Itens críticos pra o backend subir:
   - `apps/api/src/main.py` — FastAPI mínimo com `/health` (sem auth ainda)
   - `apps/api/alembic.ini` + `apps/api/migrations/env.py`
   - `apps/api/.env.example` (variáveis específicas da api)

**5. Subir e validar:**
   ```bash
   cp .env.example .env          # editar JWT_SECRET e ANTHROPIC_API_KEY
   docker compose build api      # build inicial (puxa Python 3.11 + ffmpeg)
   docker compose up -d
   curl http://localhost:3001/health   # esperar 200 OK
   ```

**6. Primeiro commit + push:**
   ```bash
   git add -A
   git commit -m "feat: bootstrap monorepo murmur (web + api docker)"
   git push -u origin main
   ```

**7. Só depois disso → entrar na Fase 1 (auth + permissões).**

### ⚠️ Avisos para o próximo chat
- **Não rodar `pip install` no host** — backend roda em Docker. Toda dep Python vai no `pyproject.toml` e instala no build da imagem.
- **`npm install` na raiz** — instala só o workspace `apps/web` (o `apps/api` não é workspace npm).
- **Camada LLM:** quando chegar na Fase 2, abrir `~/projects/prism/backend/src/services/llm/{__init__,client,config,exceptions}.py` e portar **mantendo o padrão** (singleton `llm_client`, `LLMClient.complete()`, `SUPPORTED_PROVIDERS`, exceções próprias, validação no boot). NÃO reescrever do zero.
- **Modelo Anthropic padrão:** `claude-sonnet-4-6` (referência: cutoff Jan/2026, é o atual no momento desta sessão).
- **Hot reload do backend:** vem por bind mount do `apps/api/src/` — não precisa rebuildar a imagem a cada mudança Python.
