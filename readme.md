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
