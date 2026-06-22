# Deployment

This repository contains two separately deployed pieces:

| Piece | What it is | Where it runs |
| --- | --- | --- |
| Frontend (repo root, `src/`) | Static Vite/React build | GitHub Pages |
| Backend (`backend/`) | Node.js/Express API + PostgreSQL client | Any Node host (Render, Railway, Fly.io, a VPS, etc.) |

**GitHub Pages only serves static files.** It cannot run the Node.js backend or
connect to PostgreSQL. The backend must be deployed separately, on a host that can
run a long-lived Node process and reach your PostgreSQL database. The frontend then
talks to that backend over HTTPS using `VITE_API_BASE_URL`.

**If you skip the backend deployment, GitHub Pages still shows data.** Production
builds default to `VITE_DATA_MODE=static`, which reads a pre-exported JSON snapshot
from `public/data/` instead of calling a live API — see [Section 0](#0-static-demo-data-mode-default-on-github-pages).
This is demo data only, frozen at whatever was last exported; it does not reflect
live database changes. For real live data, deploy the backend (Section 1) and switch
`VITE_DATA_MODE` to `api` (Section 2).

## 0. Static demo data mode (default on GitHub Pages)

`src/services/apiClient.ts` reads `VITE_DATA_MODE`:

- `api` (dev default) — calls `VITE_API_BASE_URL` as before.
- `static` (production default) — fetches pre-exported JSON files from
  `VITE_STATIC_DATA_BASE_URL` (defaults to `${import.meta.env.BASE_URL}data`, i.e.
  whatever `base` is set to in `vite.config.ts` + `/data`) instead of hitting any
  backend at all.

This mode exists purely so the GitHub Pages build shows *something* before a backend
is deployed. It is read-only sample data, not live data: the customer/factory
dropdowns are limited to whatever was baked into `filters.json`, and changing
filters won't fetch new combinations unless matching JSON files exist for them.

### Regenerating the static snapshot

The JSON files in `public/data/` are produced by a backend script that reuses the
exact same service functions the live API routes call, so the shape always matches
what `/api/...` would return:

```bash
cd backend
npm run export:static   # requires a working DATABASE_URL — connects to real Postgres
cd ..
npm run build            # bakes the refreshed public/data/*.json into dist/
```

`backend/src/scripts/exportStaticData.ts` exports a fixed default filter scope
(customer `Travis Mathew`, factory `G3`, `2026-05-01` to `2026-06-04`) into:
`filters.json`, `overview.json`, `weekly-trend.json`, `defect-categories.json`,
`line-analysis.json`, and `stage-detail-{inline,endline,pre-final,final,third-party}.json`.

The files committed to this repo today are placeholders (all zeros/empty arrays) —
run the export script above against a real database before relying on this for an
actual demo.

### Switching a deployed site from static demo data to live data

Once a backend is deployed and reachable (Section 1):

1. Set the `VITE_API_BASE_URL` repository variable (Section 2) to the backend's URL.
2. Also set a `VITE_DATA_MODE` repository variable to `api`. Production defaults to
   `static` regardless of `VITE_API_BASE_URL`, so this step is required — setting the
   URL alone is not enough to leave demo mode.
3. Re-run the Pages workflow (push to `main`, or **Actions → Run workflow**).

## 1. Deploy the backend

1. Provision PostgreSQL (`O2_Performance` schema/database) somewhere reachable from
   your backend host — e.g. a managed Postgres add-on on the same platform you deploy
   the backend to, or any external provider.
2. Deploy `backend/` to a Node host. Build/run commands:
   ```bash
   cd backend
   npm ci
   npm run build      # tsc -> backend/dist
   npm run migrate    # one-time / on schema changes
   npm start          # node dist/server.js
   ```
3. Set these environment variables on the backend host (see `backend/.env.example`):
   - `DATABASE_URL` — connection string for the deployed PostgreSQL instance.
   - `DATABASE_SSL` — set to `true` if the database requires SSL (most managed
     Postgres hosts do; local Postgres usually does not).
   - `PORT` — port the host expects the process to listen on (often injected by the
     platform itself — check your host's docs).
   - `CORS_ORIGINS` — comma-separated list of browser origins allowed to call the API,
     e.g. `https://bunnybisanda.github.io`. `http://localhost:*` and
     `http://127.0.0.1:*` are always allowed in addition to this list, so local dev
     keeps working without extra config.
4. Confirm the deployed backend is healthy:
   ```bash
   curl https://YOUR_DEPLOYED_BACKEND_URL/api/health
   ```
   Expect a JSON body with `status` and `db` fields, e.g.
   `{ "status": "ok", "db": "ok", "timestamp": "..." }`. If `db` is not `"ok"`, the
   backend can't reach PostgreSQL — check `DATABASE_URL`/`DATABASE_SSL` before moving on.

## 2. Point the frontend at the deployed backend

The frontend never hardcodes a backend URL — it reads `VITE_API_BASE_URL` at build
time (see `src/services/apiClient.ts`). There are two ways to set it:

### Option A — GitHub Actions (already configured, recommended)

`.github/workflows/deploy-pages.yml` builds and publishes the frontend to GitHub
Pages automatically on every push to `main`, using a repository variable:

1. In GitHub: **Settings → Secrets and variables → Actions → Variables**.
2. Add a repository variable named `VITE_API_BASE_URL` with your deployed backend
   URL, including the `/api` suffix, e.g.:
   ```
   https://YOUR_DEPLOYED_BACKEND_URL/api
   ```
3. Push to `main` (or run the workflow manually via **Actions → Run workflow**).
   The build step injects this variable into the Vite build, and the workflow will
   print a warning in the Actions log if the variable is empty.

### Option B — manual local build

```bash
VITE_API_BASE_URL=https://YOUR_DEPLOYED_BACKEND_URL/api npm run build
```
This produces `dist/`, which you can publish however you like (including pushing
to a `gh-pages` branch by hand). There is no `npm run deploy` script in this repo —
publishing is handled by the GitHub Actions workflow above, not a local CLI step.

### Local development

For local dev, no setup is required beyond `npm install` — `.env.development`
already points `VITE_API_BASE_URL` at `http://localhost:4000/api`, matching the
backend's default `PORT=4000`.

## 3. How misconfiguration shows up now

These checks only apply in `api` mode (`VITE_DATA_MODE=api`) — `static` mode never
needs a backend URL at all.

`src/services/apiClient.ts` no longer silently falls back to `localhost` in a
production build. If `VITE_API_BASE_URL` is missing, empty, or left as the
`https://YOUR_DEPLOYED_BACKEND_URL/api` placeholder from `.env.production`, every
API call fails fast with **"Backend URL is not configured."** instead of quietly
trying (and failing) to reach the visitor's own machine. This surfaces through the
same error UI used for other backend failures (`DashboardError` / filter loading
error banner).

`VITE_USE_MOCK_DATA` is also read at build time purely as a safety check: this app
has no mock data path, so setting it to `true` produces an explicit error rather
than ever silently substituting fake data for real backend data. Leave it `false`.

## 4. Env file reference

| File | Committed? | Used by |
| --- | --- | --- |
| `.env.example` | yes | Template for local setup |
| `.env.development` | yes | `npm run dev` / `vite` (dev mode) |
| `.env.production` | yes (placeholder only) | `npm run build` (prod mode), unless overridden by CI |
| `backend/.env.example` | yes | Template for backend setup |
| `backend/.env` | no (gitignored) | Real backend secrets, local only |

The real production backend URL is never committed — it lives in the GitHub Actions
repository variable (Option A above) or is passed inline at build time (Option B).

| Variable | Dev default | Prod default | Purpose |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:4000/api` | unset placeholder (→ "not configured" error) | Backend URL when `VITE_DATA_MODE=api` |
| `VITE_DATA_MODE` | `api` | `static` | `api` = live backend, `static` = `public/data/*.json` |
| `VITE_STATIC_DATA_BASE_URL` | n/a (unused in `api` mode) | `/O2_Performance/data` | Where to fetch static JSON from when `VITE_DATA_MODE=static`; self-corrects to `${BASE_URL}data` if unset |
| `VITE_USE_MOCK_DATA` | `false` | `false` | Safety check only — must stay `false`, no mock implementation exists |
