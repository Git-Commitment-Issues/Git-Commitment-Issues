# Pahina - Reading Comprehension Screener

Pahina is an AI-assisted reading-comprehension assessment platform for teachers. Teachers photograph or paste a reading passage, schedule an assessment for their class, and share it with an access code or QR code. Learners answer open-ended questions, an AI provider checks each answer against the expected ideas, and the backend computes a comprehension score and diagnosis. Teachers can review and override any verdict.

## Features

- Teacher portal: class dashboard with per-skill averages, student roster and individual reports, assessment authoring, sharing (access code + QR), and answer review with overrides.
- Photo-to-passage OCR: passages are read from a photo with Tesseract.js (English + Filipino) entirely in the browser. The photo is never uploaded; only the extracted text is sent to the backend.
- Learner portal: learners sign in with their Learner Reference Number (LRN), take assessments, and see results and teacher corrections.
- AI-assisted evaluation: each answer gets a verdict (`correct`, `partial`, `missed`) with evidence from an OpenAI-compatible provider. Without a provider configured, a built-in deterministic stub is used so the app still runs end to end. The stub marks every answer `correct`, so its scores are placeholders, not real evaluations.
- Backend scoring and diagnosis: `correct` = 1.0, `partial` = 0.5, `missed`/blank = 0.0. A score of 70 or higher is `on_track`, 40 to below 70 is `comprehension_barrier`, and below 40 (or any un-overridden blank answer) is `highest_priority`. Teacher overrides trigger a recompute.
- Skills tracked: literal, inference, vocabulary, and sequencing.

## Tech stack

| Part        | Stack                                                       | Dev port |
| ----------- | ----------------------------------------------------------- | -------- |
| `backend/`  | FastAPI + uvicorn (Python 3.12), psycopg 3, httpx            | `8000`   |
| `frontend/` | React 19 + Vite, React Router 7, Tesseract.js, Recharts; served by Nginx in production | `5173`   |
| Database    | External Supabase Postgres (not bundled in this repo)        | -        |
| AI          | External OpenAI-compatible provider, e.g. OpenRouter (optional) | -     |

### Architecture

- The browser loads the static React bundle from Nginx (port 5173 -> 80 in Docker).
- The browser calls the FastAPI backend directly on port 8000. Because it is not proxied through Nginx, `VITE_API_BASE_URL` is baked into the frontend bundle at build time.
- The backend talks to Supabase Postgres (via `DATABASE_URL`) and the AI provider over HTTP.

Each feature under `backend/app/features/` exposes an `APIRouter`, registered in `app/main.py`:

- `auth` - login (teacher by name, learner by LRN) and `X-User-Id` identity
- `classrooms` - classroom management
- `assessments` - scheduling, access codes, and learner-facing views
- `evaluation` - AI-assisted checks and scoring
- `reviews` - teacher overrides
- `dashboard` - class and learner reporting

`GET /health` is an unauthenticated readiness probe. Interactive API docs are served at `/docs`.

## Prerequisites

- Git
- A [Supabase](https://supabase.com) project (free tier is fine). The schema is written for Supabase Postgres.
- Either:
  - Docker Desktop (or Docker Engine + Compose v2) for the quick start, or
  - Python 3.12+ and Node.js 18+ for local development
- Optional: an API key for an OpenAI-compatible AI provider (e.g. OpenRouter)
- Internet access the first time you use OCR, so the browser can download the English and Filipino language data (it is cached afterwards)

## Setup

### 1. Clone the repository

```bash
git clone <your-fork-or-repo-url>
cd Git-Commitment-Issues
```

### 2. Get your database connection string

In your Supabase project, open the **Connect** dialog and copy the **Session pooler** connection string (IPv4). It looks like:

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

### 3. Configure the backend

```bash
cp backend/.env.example backend/.env
```

On Windows PowerShell, `cp` works too, or use `Copy-Item backend\.env.example backend\.env`.

Open `backend/.env` and fill in at least:

```
DATABASE_URL=<your Supabase session pooler string>
CORS_ORIGINS=http://localhost:5173
```

Add `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` if you want real AI evaluation. Leave them blank to use the stub. See [Environment variables](#environment-variables).

`backend/.env` is gitignored. Never commit it.

### 4. Configure the frontend (local development only)

```bash
cp frontend/.env.example frontend/.env
```

The default `VITE_API_BASE_URL=http://localhost:8000` works for local development. Docker passes this value as a build argument instead.

### 5. Initialize the database

Pick one option.

**Option A: create the schema and load demo data (recommended for a first run)**

> Warning: `reset` drops the `answers`, `assessments`, `users`, and `classrooms` tables before recreating them. Only run it against a development database.

With Docker:

```bash
docker compose build backend
docker compose run --rm backend python -m app.database.reset
```

Or with a local Python environment (see [Local development](#local-development-without-docker)):

```bash
cd backend
python -m app.database.reset
```

**Option B: empty schema only**

Open the Supabase **SQL Editor**, paste the contents of `backend/app/database/schema.sql`, and run it. To add demo data later, run `python -m app.database.seed` (it assumes empty tables).

### 6. Check the database connection (optional)

```bash
cd backend
python -m app.scripts.check_db
```

This read-only check prints a report and exits `0` on success.

### 7. Run the app

See [Quick start (Docker)](#quick-start-docker) or [Local development](#local-development-without-docker), then open http://localhost:5173.

### 8. Sign in with the demo data

If you loaded demo data in step 5:

| Role    | How to sign in                                         |
| ------- | ------------------------------------------------------ |
| Teacher | Name: `Ms. Reyes`                                      |
| Learner | LRN: `999900000001` (through `999900000009`)           |

The demo includes three completed assessment batches, one upcoming batch (access code `BATCH4`), and a pending teacher correction, so the dashboards have data to show. All names, LRNs, and answers are fictional.

## Quick start (Docker)

After completing setup steps 1 to 3 and 5:

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

To stop, press Ctrl+C, then run `docker compose down`.

> Keep `CORS_ORIGINS` in `backend/.env` aligned with the frontend origin. For the default Docker setup that is `http://localhost:5173`.

## Local development (without Docker)

### Backend (Python 3.12+)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1      # Windows PowerShell
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

If PowerShell blocks `Activate.ps1`, allow scripts for the current session only:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

### Frontend (Node.js 18+; the Docker image uses Node 22)

```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

Other scripts: `npm run build`, `npm run preview`, `npm run lint`.

See `frontend/README.md` for the design system and frontend project structure.

## Environment variables

### Backend (`backend/.env`)

| Variable       | Required | Description                                                                   |
| -------------- | -------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL` | yes      | Supabase Postgres connection string (session pooler). The app aborts at startup if unset. |
| `CORS_ORIGINS` | yes      | Comma-separated allowed origins. The app aborts at startup if empty.          |
| `AI_API_KEY`   | no       | API key for the AI provider. Blank uses the deterministic stub.               |
| `AI_BASE_URL`  | no       | Base URL of the OpenAI-compatible provider, e.g. `https://openrouter.ai/api/v1`. |
| `AI_MODEL`     | no       | Model identifier requested from the provider, e.g. `openai/gpt-4o`.           |
| `TIMEZONE`     | no       | IANA timezone for "today" calculations. Defaults to `Asia/Manila`.            |

### Frontend (build time)

| Variable            | Default                 | Description                                   |
| ------------------- | ----------------------- | --------------------------------------------- |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Base URL of the backend API, inlined into the bundle at build time. |

Because Vite inlines this value, it is a build argument for the frontend image, not a runtime variable. Changing it requires a rebuild.

Secrets live only in gitignored `.env` files and reach the backend container at runtime through Compose `env_file`. They are never baked into an image layer.

## Backend scripts

Run these from `backend/` with the virtual environment active, or inside the container with `docker compose run --rm backend <command>`.

| Command                             | What it does                                                      |
| ----------------------------------- | ----------------------------------------------------------------- |
| `python -m app.scripts.check_db`    | Read-only connectivity check against `DATABASE_URL`.              |
| `python -m app.database.seed`       | Inserts demo data into an empty schema.                           |
| `python -m app.database.reset`      | Destructive: drops tables, recreates the schema, and reseeds.     |
| `python -m app.scripts.smoke`       | Destructive: resets the DB, then walks schedule -> submit -> evaluate -> override against the stub AI and prints PASS/FAIL. |

## Docker reference

| File                  | Purpose                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `docker-compose.yml`  | Orchestrates `backend` + `frontend`. The backend reads `backend/.env`. |
| `backend/Dockerfile`  | Python 3.12 slim; runs uvicorn as a non-root user; `/health` check. |
| `frontend/Dockerfile` | Multi-stage: Node 22 builds the Vite bundle, Nginx 1.27 serves it. |
| `frontend/nginx.conf` | SPA routing fallback and long-cache headers for fingerprinted assets. |

```bash
docker compose up --build              # build + run everything
docker compose up -d --build           # run in the background
docker compose logs -f                 # tail logs
docker compose down                    # stop + remove containers
docker compose build backend           # rebuild just the backend
```

## Deploying

- Build the frontend with the deployed API URL:

  ```bash
  docker build --build-arg VITE_API_BASE_URL=https://api.example.com -t anaread-frontend ./frontend
  ```

  Or set `VITE_API_BASE_URL` in your shell before `docker compose build`; Compose reads it via `${VITE_API_BASE_URL}`.

- Add the production frontend origin to `CORS_ORIGINS` in the backend environment.
- Terminate TLS at a reverse proxy or load balancer in front of the containers.

> Security note: login is an MVP flow. Teachers sign in by name and learners by LRN, with no password, and the API trusts the `X-User-Id` header to identify the caller. Anyone who knows a name, an LRN, or a user id can act as that user. Add real authentication before storing real learner data or exposing the API publicly.

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| Backend exits with `Missing required environment variable` | Set `DATABASE_URL` and `CORS_ORIGINS` in `backend/.env`. |
| Browser shows CORS errors | `CORS_ORIGINS` must exactly match the frontend origin, e.g. `http://localhost:5173` (no trailing slash). |
| Frontend calls the wrong API URL in Docker | `VITE_API_BASE_URL` is set at build time. Rebuild with `docker compose build frontend`. |
| `psycopg` / `libpq` fails to load on Windows | Some Windows policies block the native library. Run the backend with Docker instead. |
| First OCR scan is slow | Tesseract is downloading the language data. Later scans use the browser cache. |

## Project layout

```
.
├── backend/                 # FastAPI service
│   ├── app/
│   │   ├── main.py          # app entry: CORS, /health, routers
│   │   ├── config.py        # env-driven settings (fails fast)
│   │   ├── features/        # auth, classrooms, assessments, evaluation, reviews, dashboard
│   │   ├── middleware/      # request dependencies (current user)
│   │   ├── ai/              # AI provider client, prompts, and stub
│   │   ├── database/        # connection pool, schema.sql, seed, reset
│   │   └── scripts/         # check_db, smoke
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                # React + Vite app (see frontend/README.md)
│   ├── src/
│   │   ├── pages/           # teacher, learner, and public student pages
│   │   ├── ocr/             # in-browser Tesseract.js pipeline
│   │   ├── services/        # HTTP client and API repository
│   │   └── session/         # signed-in user state
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

## Accessibility

The frontend targets WCAG AA: semantic landmarks, a skip-to-content link, visible focus rings, keyboard support, and reduced-motion support. Full WCAG validation still requires manual testing with assistive technologies and expert review.
