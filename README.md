# Time2Pay

Time2Pay is a dual-mode contractor invoicing app. Run local-first with SQLite or hosted multi-user with Supabase/Postgres, track sessions, group work into invoices, sync with Mercury, and ship as an installable PWA.

## Features

- Session timer with manual entries
- Client, project, and task organization
- Invoice generation from tracked sessions
- Mercury API integration through server-side API routes
- PDF invoice export
- Installable PWA with update-aware service worker
- Local SQLite persistence for app data
- Hosted multi-user auth + data mode (Supabase)

## Quick Start (Copy/Paste)

### PowerShell (Windows, Node 20+)

```powershell
git clone https://github.com/DavidJGrimsley/time2pay
cd time2pay
npm ci
Copy-Item .env.example .env
# edit .env and set MERCURY_API_KEY
npm run build:web
npm run serve:prod:env
```

Open `http://localhost:3000`.

### Bash (macOS/Linux, Node 20+)

```bash
git clone https://github.com/DavidJGrimsley/time2pay
cd time2pay
npm ci
cp .env.example .env
# edit .env and set MERCURY_API_KEY
npm run build:web
npm run serve:prod:env
```

Open `http://localhost:3000`.

## Environment Variables

Set these in `.env`:

- `MERCURY_API_KEY` (required to use your bank account): your Mercury API key
- `MERCURY_BASE_URL` (optional): defaults to `https://api.mercury.com/api/v1`
- `GITHUB_CLIENT_ID` (optional): server-side GitHub OAuth app client id
- `GITHUB_CLIENT_SECRET` (optional): server-side GitHub OAuth app client secret
- `EXPO_PUBLIC_GITHUB_CLIENT_ID` (optional): client-visible GitHub OAuth id used to show the Sign in with GitHub button
- `EXPO_PUBLIC_TIME2PAY_DATA_MODE` (optional): `local` (default) or `hosted`
- `EXPO_PUBLIC_SUPABASE_URL` (required in hosted mode)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (required in hosted mode)
- `EXPO_PUBLIC_HOSTED_API_BASE_URL` (required for hosted writes in non-web runtime; example: `https://time2pay.app`)
- `EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL` (optional): full OAuth/magic-link callback URL
- `EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_PATH` (optional): path fallback for callback URL, defaults to `/dashboard`
- `SUPABASE_SERVICE_ROLE_KEY` (required for server-side admin operations)
- `DATABASE_URL` (recommended for Drizzle migrations and runtime SQL clients; Supabase pooler, usually `6543`)
- `DATABASE_DIRECT_URL` (optional direct database host/port, usually `5432`, only if your network supports direct connectivity)
- `DRIZZLE_DATABASE_URL` (optional): explicit override used by Drizzle CLI (`db:migrate`, `db:check`, etc.)
- `PORT` (optional): defaults to `3000`

If `MERCURY_API_KEY` is missing, `/api/mercury` returns `400`.
If GitHub OAuth env vars are missing, `/api/github` returns `501` and the Sign in with GitHub button is hidden.
If hosted env vars are missing while `EXPO_PUBLIC_TIME2PAY_DATA_MODE=hosted`, auth/data flows fail at startup.

## Hosted Mode (Supabase + Multi-User)

Set `EXPO_PUBLIC_TIME2PAY_DATA_MODE=hosted` to enable Supabase auth + hosted data.

Hosted mode includes:
- Email magic-link + GitHub OAuth sign-in
- User-scoped profile + data reads from Supabase
- API-routed hosted writes (`/api/db/<domain>/<action>`)
- Strict write payload validation with typed API error statuses (`401/403/404/409/422/500`)

Supabase callback setup:
1. In Supabase Auth settings, add redirect URLs for:
   - `http://localhost:3000/dashboard`
   - `https://time2pay.app/dashboard`
2. In `.env`, set either:
   - `EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL=https://time2pay.app/dashboard` (production), or
   - `EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_PATH=/dashboard` (origin-relative fallback).

Drizzle migration connection note:
- `drizzle.config.ts` precedence is `DRIZZLE_DATABASE_URL -> DATABASE_URL -> DATABASE_DIRECT_URL`.
- For most setups, set `DATABASE_URL` to Supabase pooler (`6543`) and run migrations directly.
- Use `DATABASE_DIRECT_URL` only when direct host networking is confirmed in your environment.
- If tables already exist but `drizzle.__drizzle_migrations` is empty, align the baseline ledger row first, then rerun `npm run db:migrate`.

## Run Modes

### Production-style local server (recommended)

```bash
npm run build:web
npm run serve:prod:env
```

This serves `dist/client`, runs `dist/server`, and enables API routes + PWA behavior.

### Dev mode

```bash
npm run web
```

Use this for fast UI iteration. For production-equivalent API-route/PWA checks, use the production-style server above.

## Self-Hosting (Each User Uses Their Own Key)

Each user can run their own local or VPS instance with their own `.env` and Mercury key.

1. Clone repo and install deps: `npm ci`
2. Create `.env` from `.env.example`
3. Set user-specific `MERCURY_API_KEY`
4. Build: `npm run build:web`
5. Start: `npm run serve:prod:env`
6. Open app and test via **Invoices -> Test Mercury Connection**

Update flow:

1. Pull latest code
2. `npm ci`
3. `npm run build:web`
4. Restart server

## GitHub OAuth Setup (Optional)

The app works fully without OAuth. You can still paste a PAT manually in **Profile -> Integrations**.

To enable **Sign in with GitHub**:

1. Create a GitHub OAuth App at `https://github.com/settings/developers`.
2. Set Authorization callback URL to your profile route, for example:
   - Local: `http://localhost:3000/profile`
   - Hosted: `https://yourdomain.com/profile`
3. Add env vars:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `EXPO_PUBLIC_GITHUB_CLIENT_ID` (same value as `GITHUB_CLIENT_ID`)
4. Rebuild and restart:
   - `npm run build:web`
   - `npm run serve:prod:env`

Notes:

- OAuth exchange is handled server-side by `POST /api/github`.
- If OAuth env vars are not configured, the Sign in with GitHub button is not shown.

### Node <20 fallback (no `--env-file`)

PowerShell example:

```powershell
$env:PORT="3030"
$env:MERCURY_API_KEY="<their-own-key>"
$env:MERCURY_BASE_URL="https://api.mercury.com/api/v1"
npm run serve:prod
```

## PWA

- Build includes service worker generation in `npm run build:web`
- Install prompt depends on browser/platform rules and HTTPS (or localhost)
- Can be installed by clicking the 3 dots in Google Chrome, 'Cast, save, and share', 'Install ...'
- On new deploys, service worker updates and the app refreshes into the new version

## Local Data Backup and Restore (Web/PWA)

Use this before switching localhost ports, browser profiles, or machines:

1. Open **Profile -> Data Backup**
2. Click **Export Data** to download a JSON backup of local data
3. On the new origin/environment, open the same section and click **Import Data**
4. Confirm the replace-all prompt to restore your data

Notes:

- Import replaces current local data for that browser origin.
- You can enable/disable a pre-import rollback backup in the same section.
- Backups include profile, clients, projects, tasks, sessions, breaks, invoices, and timer selection.
- Mercury API keys are server-side env vars and are not part of backup files.

## Plesk Deployment (Node App)

1. Upload project
2. Install dependencies: `npm ci`
3. Configure env vars (`MERCURY_API_KEY`, optional `MERCURY_BASE_URL`, optional `PORT`)
4. Build: `npm run build:web`
5. Startup command:
   - Node 20+: `npm run serve:prod:env`
   - If env vars are managed by Plesk directly: `npm run serve:prod`
6. Keep HTTPS enabled for full PWA install/service-worker behavior
7. For hosted mode, ensure Supabase auth redirects include `https://time2pay.app/dashboard`

## Available Scripts

- `npm run web` - Expo web dev server
- `npm run db:generate` - generate Drizzle SQL from `src/database/hosted/**/schema.ts`
- `npm run db:migrate` - run connection preflight + apply migrations using `DRIZZLE_DATABASE_URL` or `DATABASE_URL` (with `DATABASE_DIRECT_URL` fallback)
- `npm run db:migrate:raw` - run plain `drizzle-kit migrate` (no preflight checks)
- `npm run db:studio` - open Drizzle Studio
- `npm run db:check` - validate migration consistency
- `npm run icons:sync` - sync icon assets into `public/`
- `npm run build:web` - icons + web export + service worker generation
- `npm run serve:prod` - run production server (env from shell)
- `npm run serve:prod:env` - run production server with `.env` (Node 20+)
- `npm run typecheck` - TypeScript type checks
- `npm run lint` - lint codebase

## Security Notes

- Mercury key is server-side env only (not entered in Profile UI).
- Do not commit `.env`.
- Rotate keys if a server or machine is compromised.
