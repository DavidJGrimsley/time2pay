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
# edit .env and set hosted/Supabase vars; signed-in users save Mercury keys in Profile
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
# edit .env and set hosted/Supabase vars; signed-in users save Mercury keys in Profile
npm run build:web
npm run serve:prod:env
```

Open `http://localhost:3000`.

## Environment Variables

Set these in `.env`:

- `MERCURY_API_KEY_ENCRYPTION_SECRET` (required in hosted mode): server-side secret used to encrypt signed-in users' saved Mercury API keys in Supabase
- `MERCURY_SANDBOX_API_KEY` (required for tour mode Mercury flows): Mercury sandbox API key
- `MERCURY_SANDBOX_BASE_URL` (required for tour mode Mercury flows): defaults to `https://api-sandbox.mercury.com/api/v1`
- `GITHUB_CLIENT_SECRET` (optional): server-side GitHub OAuth app client secret
- `EXPO_PUBLIC_GITHUB_CLIENT_ID` (optional): GitHub OAuth app client id used by the client UI and server token exchange
- `EXPO_PUBLIC_TIME2PAY_DATA_MODE` (optional): `local` (default) or `hosted`
- `EXPO_PUBLIC_SITE_ORIGIN` (required in hosted mode): canonical site origin used for hosted auth redirects and hosted API writes. Set this per environment, for example `https://time2pay.app` for production or your `*.plesk.page` staging URL for `test`
- `TIME2PAY_FAIL_BUILD_IF_LOCAL` (optional): when truthy (`1/true/yes/on`), blocks web export if data mode resolves to `local`
- `EXPO_PUBLIC_SUPABASE_URL` (required in hosted mode)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (required in hosted mode)
- `SUPABASE_SERVICE_ROLE_KEY` (required for server-side admin operations)
- `DATABASE_URL` (recommended for Drizzle migrations and runtime SQL clients; Supabase pooler, usually `6543`)
- `DATABASE_DIRECT_URL` (optional direct database host/port, usually `5432`, only if your network supports direct connectivity)
- `DRIZZLE_DATABASE_URL` (optional): explicit override used by Drizzle CLI (`db:migrate`, `db:check`, etc.)
- `PORT` (optional): defaults to `3000`

Environment file convention:
- Plesk deploy/build scripts read `.env.plesk`.
- `server.js` also reads `.env.plesk` for runtime startup on Plesk.
- Keep `.env.test` and `.env.production` as minimal key reference files for Plesk values.

Plesk note:
- Set `EXPO_PUBLIC_TIME2PAY_DATA_MODE=hosted` in your Plesk Node app environment for hosted deployments, or provide it via `.env.plesk`.
- If this is missing or set to `local`, hosted auth/data flows are intentionally disabled.

If a signed-in hosted user has no saved Mercury API key, Mercury production actions return `400`.
If `MERCURY_SANDBOX_API_KEY` is missing, tour mode Mercury actions return `400`.
If GitHub OAuth env vars are missing, `/api/github` returns `501` and the Sign in with GitHub button is hidden.
If hosted env vars are missing while `EXPO_PUBLIC_TIME2PAY_DATA_MODE=hosted`, startup fails fast.
If deprecated hosted env vars are present in hosted mode (`EXPO_PUBLIC_HOSTED_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL`, `EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_PATH`, `EXPO_PUBLIC_MERCURY_PROXY_PATH`, `SITE_ORIGIN`), startup fails fast.
If `TIME2PAY_FAIL_BUILD_IF_LOCAL` is truthy, deployment builds fail fast unless mode resolves to `hosted`.

## Hosted Mode (Supabase + Multi-User)

Set `EXPO_PUBLIC_TIME2PAY_DATA_MODE=hosted` to enable Supabase auth + hosted data.

Hosted mode includes:
- Email magic-link + GitHub OAuth sign-in
- User-scoped profile + data reads from Supabase
- API-routed hosted writes (`/api/db/<domain>/<action>`)
- Strict write payload validation with typed API error statuses (`401/403/404/409/422/500`)

Hosted mode guardrails:
- Unauthenticated hosted users can access landing/sign-in and can opt into tour mode.
- Authenticated hosted users stay profile-gated until required profile fields are complete.
- Tour mode bypasses profile completion lock UI so the demo flow is usable immediately.

Supabase callback setup:
1. In Supabase Auth settings, add redirect URLs for:
   - `http://localhost:3000/dashboard`
   - `https://time2pay.app/dashboard`
2. In `.env`, set `EXPO_PUBLIC_SITE_ORIGIN` to the exact deployed origin for that environment.

Drizzle migration connection note:
- `drizzle.config.ts` precedence is `DRIZZLE_DATABASE_URL -> DATABASE_URL -> DATABASE_DIRECT_URL`.
- For most setups, set `DATABASE_URL` to Supabase pooler (`6543`) and run migrations directly.
- Use `DATABASE_DIRECT_URL` only when direct host networking is confirmed in your environment.
- If tables already exist but `drizzle.__drizzle_migrations` is empty, align the baseline ledger row first, then rerun `npm run db:migrate`.

## Runtime Diagnostics (Auth/Profile Gate)

Use this when production auth/routing behavior is unclear:

- Add `?debugAuth=1` to any app URL to enable structured auth/profile-gate diagnostics in browser console.
- Debug mode persists via localStorage key `time2pay.debug.auth`.
- Disable diagnostics with `?debugAuth=0`.

Server startup diagnostics:
- `server.js` logs whether data mode resolves to `local` or `hosted`.
- In hosted mode, it enforces the strict env contract and fails startup when required vars are missing or deprecated vars are present.

## Run Modes

### Production-style local server (recommended)

```bash
npm run build:web
npm run serve:prod:env
```

This serves `dist/client`, runs `dist/server`, and enables API routes + PWA behavior.

Windows note:
- If Expo export crashes with a Windows access violation code, `build:web:deploy` now retries once automatically.
- For most stable behavior, use Node 20 LTS for local build/serve workflows.

### Dev mode

```bash
npm run web
```

Use this for fast UI iteration. For production-equivalent API-route/PWA checks, use the production-style server above.

## Self-Hosting (Each User Uses Their Own Key)

Production Mercury access is now user-scoped in hosted mode. Each signed-in user saves their own Mercury production API key in **Profile -> Integrations**, where Time2Pay encrypts it before storing it in Supabase.

1. Clone repo and install deps: `npm ci`
2. Create `.env` from `.env.example`
3. Set hosted/Supabase vars and `MERCURY_API_KEY_ENCRYPTION_SECRET`
4. Run `npm run db:migrate`
5. Build: `npm run build:web`
6. Start: `npm run serve:prod:env`
7. Sign in, save your Mercury production API key in **Profile -> Integrations**, then use the Mercury invoice builder

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
   - `GITHUB_CLIENT_SECRET`
   - `EXPO_PUBLIC_GITHUB_CLIENT_ID`
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
- Mercury API keys are encrypted hosted credentials and are not part of local backup files.

## Plesk Deployment (Node App)

Use Plesk as the deployment target, but deploy the repository into the Node app root, not into `dist/client`.

1. Create two separate Plesk Git deployments:
   - Staging/temp domain tracks branch `test`
   - Production domain tracks branch `main`
2. For each environment, set the Git deployment target to the **Application Root** and do not deploy directly into `dist/client`.
3. Keep each Node.js app aligned with `server.js`:
   - Application Root: the site root for that domain
   - Document Root: `<application-root>/dist/client`
   - Startup File: `server.js`
4. Configure env vars in each Plesk app:
   - required app/server vars such as `MERCURY_API_KEY_ENCRYPTION_SECRET`
   - tour/demo vars such as `MERCURY_SANDBOX_API_KEY` and `MERCURY_SANDBOX_BASE_URL`
   - optional runtime vars such as `PORT`
   - `EXPO_PUBLIC_SITE_ORIGIN` set to the matching domain for that environment
   - if Plesk does not expose those vars to Git Additional deployment actions, place a single `.env.plesk` file in the app root so both build scripts and `server.js` can read it
5. In each Plesk Git repository settings page, enable **Additional deployment actions** and use:

```sh
sh ./scripts/plesk-post-deploy.sh
```

This runs `npm ci --include=dev`, builds `dist/client` + `dist/server`, and touches `../tmp/restart.txt` so the Node app restarts.

6. In GitHub repository `Settings -> Secrets and variables -> Actions`, add:
    - `PLESK_STAGING_WEBHOOK_URL`
    - `PLESK_PRODUCTION_WEBHOOK_URL`
   - If this repo still has the older typo'd secret name `PLESK__PRODUCTION_WEBHOOK_URL`, the workflow accepts it temporarily, but rename it to `PLESK_PRODUCTION_WEBHOOK_URL` when you can.
7. Pushes now flow like this:
    - PRs into `test` or `main` run the `Quality` check
    - pushes to `test` that pass `Quality` trigger `Deploy Staging`, which validates the webhook secret and then fires the staging Plesk webhook
    - pushes to `main` that pass `Quality` trigger `Deploy Production`, which validates the webhook secret and then fires the production Plesk webhook
    - PRs into `main` also run `Require Main PR Source`, which only allows `test` or `hotfix/*`
8. Keep HTTPS enabled for full PWA install/service-worker behavior.
9. For hosted mode, ensure Supabase auth redirects include the correct callback URL for each environment, especially `https://time2pay.app/dashboard` for production.
10. Recommended GitHub rulesets after the new checks appear:
   - `test`: require pull request, require `Quality`, require up-to-date branch, block force pushes, restrict deletions
   - `main`: require pull request, require `Quality` and `Require Main PR Source`, require up-to-date branch, block force pushes, restrict deletions

Notes:

- `build:web:deploy` skips `icons:sync`, which is intentional for CI and Plesk because the repo already tracks the built public icons while the source `time2pay_icons/` folder is local-only.
- `build:web:deploy` generates `dist/client/__time2pay_build.txt` and `dist/client/__time2pay_build.json` for deploy diagnostics and manual readiness checks.
- CI currently uses Node 22 plus npm 11 to keep `npm ci` stable against this repo's Expo/React Native dependency graph.
- If you change the active Node version in Plesk, re-verify `.github/workflows/ci.yml` against the supported Expo/npm toolchain and update it if needed.

## Available Scripts

- `npm run web` - Expo web dev server
- `npm run db:generate` - generate Drizzle SQL from `src/database/hosted/**/schema.ts`
- `npm run db:migrate` - run connection preflight + apply migrations using `DRIZZLE_DATABASE_URL` or `DATABASE_URL` (with `DATABASE_DIRECT_URL` fallback)
- `npm run db:migrate:raw` - run plain `drizzle-kit migrate` (no preflight checks)
- `npm run db:studio` - open Drizzle Studio
- `npm run db:check` - validate migration consistency
- `npm run icons:sync` - sync icon assets into `public/`
- `npm run build:web:deploy` - web export + service worker generation (CI/Plesk-safe)
- `npm run build:web` - icons sync + deploy build
- `npm run serve:prod` - run production server (env from shell)
- `npm run serve:prod:env` - run production server with `.env` (Node 20+)
- `npm run typecheck` - TypeScript type checks
- `npm run lint` - lint codebase

## Security Notes

- Mercury key is server-side env only (not entered in Profile UI).
- Do not commit `.env`.
- Rotate keys if a server or machine is compromised.
