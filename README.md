# Time2Pay

Time2Pay is for contractors to track time, bill clients, and manage expenses.

## Current implementation focus

- Phase 1 local-first web app.
- Local database uses **expo-sqlite**.
- Schema and typed data-access helpers are being implemented in `src/database/db.ts`.

## Data layer status

Implemented:
- SQLite database initialization (`time2pay.db`)
- Tables: `clients`, `sessions`, `invoices`
- Helpers for client creation, session start/stop, manual session entry, listing sessions, invoice creation, and linking sessions to invoices

## Next steps

- Bootstrap Expo app shell and screens/components.
- Connect UI flows to the database layer.
- Add invoice PDF generation and payment-link composition.
