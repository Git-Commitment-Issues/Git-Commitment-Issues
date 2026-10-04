# AnaRead - Reading Comprehension Screener

AnaRead is an AI-assisted reading-comprehension assessment platform for Grades 7-12 teachers. Teachers schedule assessments, learners take them, an AI provider assists with checks, and the backend computes scoring and diagnosis with teacher override support.

This repository is a full-stack monorepo:

| Part         | Stack                                           | Dev port |
| ------------ | ----------------------------------------------- | -------- |
| `backend/`   | FastAPI + uvicorn (Python 3.12), psycopg        | `8000`   |
| `frontend/`  | React 19 + Vite, served by Nginx in production  | `5173`   |

The backend connects to an **external Supabase Postgres** instance and an **external AI provider** (OpenAI-compatible) over HTTP. There is no database bundled in this repo.

## Architecture

- The browser loads the static React bundle from Nginx (port 5173 -> 80).
- The browser calls the FastAPI backend directly on port 8000.
- The backend talks to external Supabase Postgres (via `DATABASE_URL`) and an external AI provider over HTTP.

Because the browser calls the backend directly (not proxied through Nginx), `VITE_API_BASE_URL` is baked into the frontend bundle at build time.

### Backend feature modules

Each feature under `backend/app/features/` exposes an `APIRouter`, registered in `app/main.py`:

- `auth` - lightweight `X-User-Id` identity
- `classrooms` - classroom management
- `assessments` - scheduling and learner-facing views
- `evaluation` - AI-assisted checks and scoring
- `reviews` - teacher overrides
- `dashboard` - class/learner reporting

An unauthenticated `GET /health` probe is exposed for readiness checks, and interactive API docs are served at `/docs`.

## Quick start (Docker)

The fastest way to run the whole stack. Requires Docker Desktop (or Docker Engine + Compose v2).

1. Configure backend secrets. Copy the template and fill in the values:

```bash
cp backend/.env.example backend/.env
```

`backend/.env` is gitignored and holds the Supabase `DATABASE_URL`, the AI provider credentials, `CORS_ORIGINS`, and `TIMEZONE`. See Environment variables below.

2. Build and run:

```bash
docker compose up --build
```

3. Open the app:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

To stop: Ctrl+C, then `docker compose down`.

> Keep `CORS_ORIGINS` in `backend/.env` aligned with the frontend origin. For the default Docker setup that is http://localhost:5173.

## Local development (without Docker)

### Backend (Python 3.12+)

```
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1      # Windows PowerShell
# source .venv/bin/activate    # macOS/Linux
pip install -r requirements.txt
cp .env.example .env            # then fill in values
uvicorn app.main:app --reload --port 8000
```

### Frontend (Node.js 18+; Docker image uses Node 22)

```
cd frontend
npm install
cp .env.example .env            # VITE_API_BASE_URL defaults to http://localhost:8000
npm run dev                     # http://localhost:5173
```

See `frontend/README.md` for the full frontend design-system and project-structure documentation.

## Environment variables

### Backend (`backend/.env`)

| Variable       | Required | Description                                                    |
| -------------- | -------- | -------------------------------------------------------------- |
| `DATABASE_URL` | yes      | Supabase Postgres connection string (pooler). App aborts at startup if unset. |
| `CORS_ORIGINS` | yes      | Comma-separated allowed origins. App aborts at startup if empty.              |
| `AI_API_KEY`   | no       | API key for the AI provider used during evaluation.                       |
| `AI_BASE_URL`  | no       | Base URL of the AI provider endpoint (OpenAI-compatible).                 |
| `AI_MODEL`     | no       | Model identifier requested from the AI provider.                         |
| `TIMEZONE`     | no       | IANA timezone for "today" calculations. Defaults to `Asia/Manila`.        |

### Frontend (build-time)

`VITE_API_BASE_URL` is the base URL of the backend API. Vite inlines it into the bundle at build time, so it is a **build argument** for the frontend image, not a runtime variable. Defaults to http://localhost:8000.

Secrets live only in gitignored `.env` files and are passed to the backend container at runtime via Compose `env_file`. They are never baked into an image layer.

## Docker reference

| File                    | Purpose                                                  |
| ----------------------- | --------------------------------------------------------- |
| `docker-compose.yml`     | Orchestrates `backend` + `frontend`. Backend reads `backend/.env`.     |
| `backend/Dockerfile`     | Python 3.12 slim; runs uvicorn; non-root; /health check.           |
| `frontend/Dockerfile`    | Multi-stage: Node 22 builds the Vite bundle, Nginx 1.27 serves it. |
| `frontend/nginx.conf`    | SPA routing fallback and long-cache for fingerprinted assets.       |

### Common commands

```
docker compose up --build              # build + run everything
docker compose up -d --build           # run in the background
docker compose logs -f                  # tail logs
docker compose down                     # stop + remove containers
docker compose build backend            # rebuild just the backend
```

### Production notes

- Rebuild the frontend with the deployed API URL:

```bash
docker build --build-arg VITE_API_BASE_URL=https://api.example.com -t anaread-frontend ./frontend
```

  Or set `VITE_API_BASE_URL` in your environment before `docker compose build` (Compose reads it via `${VITE_API_BASE_URL}`).

- Add the production frontend origin to `CORS_ORIGINS` in the backend environment.
- Terminate TLS at a reverse proxy / load balancer in front of these containers.

## Project layout

```
.
├── backend/            # FastAPI service
│  ├── app/
│      ├── main.py     # app entry: CORS, /health, routers
│      ├── config.py   # env-driven settings (fails fast)
│      ├── features/   # auth, classrooms, assessments, evaluation, reviews, dashboard
│      ├── ai/         # AI provider client
│      └── database/   # connection, schema, seed
│  ├── Dockerfile
│  └── requirements.txt
├── frontend/           # React + Vite app (see frontend/README.md)
│  ├── Dockerfile
│  └── nginx.conf
└── docker-compose.yml
```

## Accessibility

The frontend targets WCAG AA (semantic landmarks, visible focus rings, keyboard support, reduced-motion support). Full WCAG validation still requires manual testing with assistive technologies and expert review.
