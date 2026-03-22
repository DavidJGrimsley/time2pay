# Time2Pay - Project Info

## Vision
Time2Pay is an open-source, self-hostable time tracking and invoicing system for freelancers and small teams.

Core principles:
- Local-first support
- Hosted multi-user support
- Open source core
- Minimal operational overhead

## Current Product State

### Runtime modes
- `local` mode: Expo Router app + `expo-sqlite` provider
- `hosted` mode: Supabase Auth + Postgres (Drizzle) provider
- App-facing DB contract remains stable across both modes via `src/database/db.ts`

### Hosted architecture
- Auth: Supabase email magic-link + GitHub OAuth
- Reads: direct Supabase client (RLS-enforced)
- Writes: API routes under `src/app/api/db/<domain>/[action]+api.ts`
- Validation: route-level zod payload parsing + typed route status handling
- Schema: domain files in `src/database/hosted/**/schema.ts`
- Migrations: Drizzle migrations in `drizzle/migrations`

### Migration state
- Supabase schema is applied
- Drizzle migration ledger is aligned (`drizzle.__drizzle_migrations` has baseline row)
- Follow-on schema changes should use:
  1. `npm run db:generate`
  2. `npm run db:migrate`

## Integrations
- Mercury API (server-side only): invoice generation, payment links, bank info, transaction monitoring
- GitHub OAuth for hosted sign-in and integration workflows
- PayPal link support in invoice output

## Data Domains
- User profiles
- Clients, projects, tasks
- Sessions and session breaks
- Milestones and milestone checklist items
- Invoices and invoice session links

## Near-Term Priorities
- Apply and verify complete RLS policy coverage for hosted tables
- Final callback URL and hosted auth verification on `https://time2pay.app`
- Two-user hosted smoke validation for strict tenant isolation
- VPS deployment of single Node app output (web + API routes)
