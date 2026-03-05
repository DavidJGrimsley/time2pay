# Time2Pay

Time2Pay is an Expo Router app for tracking sessions and drafting invoices. It is currently set up for a web-first build.

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

```bash
npm install
```

## Run locally (web-first)

```bash
npm start
```

Or:

```bash
npm run web
```

## Project structure

- `src/app` - Expo Router routes and layouts (`_layout.tsx`, `index.tsx`, `sessions.tsx`, `invoices.tsx`)
- `src/components` - reusable UI components
- `src/database` - data-access stubs (`db.ts`)
- `src/services` - service stubs (`mercury.ts`)

## Notes

- Routing is file-based through Expo Router (`main: expo-router/entry`).
- `src/app` is the app routing root, aligned with monorepo app structure.
- Web output is configured with Metro server output in `app.json`.
- Styling uses Uniwind (`global.css` + `metro.config.js`) with Tailwind v4 classes via `className`.
