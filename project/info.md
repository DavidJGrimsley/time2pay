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
- `tour` access mode (hosted unauthenticated): in-memory demo provider (no SQLite dependency)
- App-facing DB contract remains stable across both modes via `src/database/db.ts`
- Runtime mode selection is env-driven via `EXPO_PUBLIC_TIME2PAY_DATA_MODE` (`local` or `hosted`)

### Hosted architecture
- Auth: Supabase email magic-link + GitHub OAuth
- Reads: direct Supabase client (RLS-enforced)
- Writes: API routes under `src/app/api/db/<domain>/[action]+api.ts`
- Validation: route-level zod payload parsing + typed route status handling
- Schema: domain files in `src/database/hosted/**/schema.ts`
- Migrations: Drizzle migrations in `drizzle/migrations`

### Hosted access contract (2026-03-28)
- Unauthenticated hosted users: landing + sign-in only, unless they explicitly start tour mode
- Tour mode users: can use demo app flow without profile-completion lock UI
- Tour mode data path: in-memory provider with reset action (`Reset Tour`), avoiding filesystem-backed SQLite in hosted tour flows
- Authenticated hosted users: remain profile-first and are redirected to `/profile` until required fields are complete
- Root stack protection keeps direct unauthenticated tab access blocked and routes to `/sign-in` after hosted auth bootstrap resolves
- Tour-mode Profile integration auth actions route to `/sign-in` instead of launching external OAuth/PAT flows

### Hosted deployment env contract
- Required in hosted mode: `EXPO_PUBLIC_SITE_ORIGIN`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Required mode toggle on Plesk: `EXPO_PUBLIC_TIME2PAY_DATA_MODE=hosted`
- Hosted auth redirect targets are derived from `EXPO_PUBLIC_SITE_ORIGIN` (`/dashboard` for Supabase sign-in, `/profile` for profile GitHub OAuth)
- Startup/runtime checks now fail fast on missing required hosted vars and fail fast when deprecated hosted vars are present (`EXPO_PUBLIC_HOSTED_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL`, `EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_PATH`, `EXPO_PUBLIC_MERCURY_PROXY_PATH`, `SITE_ORIGIN`)

### Migration state
- Supabase schema is applied
- Drizzle migration ledger is aligned (`drizzle.__drizzle_migrations` has baseline row)
- Follow-on schema changes should use:
  1. `npm run db:generate`
  2. `npm run db:migrate`

### Monetization strategy
- Self-hosted Time2Pay core remains free/open source.
- Qualified Mercury referrals receive free lifetime hosted access after trusted verification.
- Hosted pricing is $20/year (the default recommendation) or $2/month.
- Existing Mercury customers and failed/expired Time2Pay referrals may receive a server-validated $20 lifetime offer.
- Self-hosted Time2Pay remains free.
- Hosted access is provider-neutral: Stripe, future Apple/Google purchases, Mercury qualification, and administrative grants resolve through `access_grants`.
- Drizzle migration `0005_handy_darwin` adds the billing tables and expanded Mercury referral state model. The live Drizzle ledger is at six applied migrations.
- Protected hosted writes support the private `TIME2PAY_ENFORCE_HOSTED_ACCESS=true` rollout switch. Keep it disabled until Stripe test products, a trusted Mercury verification workflow, and initial grants are ready.
- Stripe Checkout, in-app subscription management, and webhook code exist for web test mode; external Stripe products, secrets, webhook configuration, and provider acceptance testing remain required before activation.

## Integrations
- Mercury API (server-side only): invoice generation, payment links, bank info, transaction monitoring
- GitHub OAuth for hosted sign-in and integration workflows
- GitHub workflow mapping: customer = owner/org, project = repo, task = branch; commits are supported as session proof, and pull request support is planned
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
