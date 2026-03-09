# Time2Pay

Time2Pay is a local-first contractor invoicing app. Track sessions, group work into invoices, sync with Mercury, and run it as an installable PWA.

## Features

- Session timer with manual entries
- Client, project, and task organization
- Invoice generation from tracked sessions
- Mercury API integration through server-side API routes
- PDF invoice export
- Installable PWA with update-aware service worker
- Local SQLite persistence for app data

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
- `PORT` (optional): defaults to `3000`

If `MERCURY_API_KEY` is missing, `/api/mercury` returns `400`.

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

## Plesk Deployment (Node App)

1. Upload project
2. Install dependencies: `npm ci`
3. Configure env vars (`MERCURY_API_KEY`, optional `MERCURY_BASE_URL`, optional `PORT`)
4. Build: `npm run build:web`
5. Startup command:
   - Node 20+: `npm run serve:prod:env`
   - If env vars are managed by Plesk directly: `npm run serve:prod`
6. Keep HTTPS enabled for full PWA install/service-worker behavior

## Available Scripts

- `npm run web` - Expo web dev server
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
