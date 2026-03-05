# Time2Pay

Time2Pay is an Expo + React Native starter app for contractors to track sessions and build invoices.

## Prerequisites

- Node.js 18+
- npm 9+

## Setup

```bash
npm install
```

## Run locally (web)

```bash
npx expo start --web
```

You can also use the package script:

```bash
npm run web
```

## Project structure

- `src/components` – reusable UI placeholders (`Timer`, `SessionList`, `InvoiceBuilder`)
- `src/screens` – app screens (`Dashboard`, `Sessions`, `Invoices`)
- `src/database` – data-access stubs (`db.ts`)
- `src/services` – external service stubs (`mercury.ts`)
- `src/App.tsx` – root app layout and simple route switching

## Troubleshooting install issues

If `npm install` returns `403 Forbidden` when fetching from `registry.npmjs.org`, it usually means your current network/proxy/security policy is blocking package downloads. In that case:

1. Confirm your npm registry:

   ```bash
   npm config get registry
   ```

2. Check active npm/proxy settings:

   ```bash
   npm config list
   env | grep -i -E 'npm|proxy'
   ```

3. Retry from a network/profile with npm registry access, then run:

   ```bash
   npm install
   npm run web
   ```
