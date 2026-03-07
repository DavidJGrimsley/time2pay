# Time2Pay

Time2Pay is for contractors to track time, bill clients, and manage expenses.

## Current implementation focus

- Phase 1 local-first web app.
- Local database uses **expo-sqlite**.
- Schema and typed data-access helpers are implemented in `src/database/db.ts`.

## Data layer status

Implemented:
- SQLite database initialization (`time2pay.db`)
- Tables: `clients`, `sessions`, `invoices`
- Helpers for client creation, session start/stop, manual session entry, listing sessions, invoice creation, and linking sessions to invoices
- Schema versioning/migration flow (SQLite `PRAGMA user_version`)
- Executable core DB validation flow via `runCoreDbValidationScript` in `src/database/db.ts`
- Sync-friendly soft-delete columns (`deleted_at`) via schema migration

## Invoice pipeline status

Implemented in `src/services/invoice.ts`:
- Invoice totals calculation (hours + amount)
- PayPal payment-link formatting and validation
- Create invoice from selected sessions and link those sessions
- jsPDF export integration with runtime dependency check

## Phase 2 prep status

Implemented:
- API contract draft: `project/api-contract.md`
- PostgreSQL/Supabase field mapping: `project/supabase-mapping.md`


## Mercury API setup

1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_MERCURY_API_KEY` with your Mercury API key.
3. (Optional) Override `EXPO_PUBLIC_MERCURY_BASE_URL` for sandbox/alternate environments.
4. Start app with `npm run web` and use **Invoices -> Test Mercury Connection**.

## End-to-end testing checklist

1. Start app: `npm run web`.
2. Dashboard: enter client + optional notes, click **Clock In**, verify timer counts up.
3. Dashboard: click **Clock Out**, verify success message.
4. Sessions: open Sessions page, click **Refresh**, verify recent session appears.
5. Invoices: click **Test Mercury Connection**, verify connected status (or actionable error).
6. If you wire invoice creation in UI next, verify created invoices persist and linked sessions show as invoiced.
