# Time2Pay — TODO

## Current Status
- Branch: `feature/mercury-api-npm`
- Phase focus: Phase 1 (Web, local-first)

## Immediate Next Actions

### 1) Bootstrap Expo Web App Shell
- [x] Create Expo app structure at repo root
- [x] Add screen scaffolding (`Dashboard`, `Sessions`, `Invoices`)
- [x] Add component scaffolding (`Timer`, `SessionList`, `InvoiceBuilder`)
- [x] Ensure app runs with `expo start --web`

### 2) Complete Local Data Layer (`expo-sqlite`)
- [x] Define schema and typed helpers in `src/database/db.ts`
- [x] Add lightweight validation around date/time and duration math
- [x] Add migration/versioning strategy for schema updates
- [x] Add tests (or executable validation script) for core DB operations

### 3) Invoice Pipeline
- [x] Build invoice service for total-hours and total-amount calculations
- [x] Add jsPDF invoice export
- [x] Add PayPal payment link formatting/validation
- [x] Link selected sessions to invoice record

## Phase 2 Preparation
- [x] Add sync-friendly columns where needed (`created_at`, `updated_at`, optional `deleted_at`)
- [x] Define API contract for sessions/invoices
- [x] Map local model fields to PostgreSQL/Supabase schema

## Final MVP Pass - Random
- [x] Add ability edit sessions, make create manual session more robust like clock in, group sessions better(by week and client)
- [x] Light/dark mode
- [x] Revise copy icons script and run it to move icons over
- [x] set up pwa with automatic updates and persisting data
- [x] Revamp invoices to have user data in from section with optional branding, further format fixes
- [x] A gate on the entire dashboard buttons and interactivity to ensure the user has filled out the profile screen first
- [x] Move all alerts from inline style to system alert window because inline alerts are not obvious enough and can lead to user frustration 
- [x] Export & import user data including all profile, clients, time tracked, etc.
- [x] Refine github integration - when adding the commit message to the notes, there is no indication that this comes from github or is associated with a commit or anything. I want the whoever looks at the invoice to be able to click a link for each project that takes them to the github commit for that session. the task being the branch name means this could be autofilled for the user. the user should be able to start create a client, project, and task, all from one github link. this should be a separate button on the dashboard maybe so the user can see a modal open that explains the flow. let's also explore sign in with github options but idk if that can be done self-hosted.
- [x] Make a landing page that explains how the app works and that it's best if you have mercury banking with at least their 'Plus' plan to take advantage of the invoicing but that there is still some mercury functionality either way. Formatting: if the page were split into thirds, it should have our logo really big centered on the left third, and a big display font title of our app and caption, then the user will scroll to see the rest of how the app works, then they will see the let's get started button at the bottom. It shouldn't be very long, like 3 pages (of full width content, please use responsive styling so it would be of course longer on smaller screens.)
## Mercury Integration
- [x] Incubate Mercury SDK/UI package work in this branch and publish it on npm
- [x] Switch the app from local Mercury workspaces to published `@mr.dj2u/*` packages
- [x] Move the package roadmap and release/versioning backlog to `f:\ReactNativeApps\mercury-bank-sdk\project\todo.md`


## Longer-Term
- [ ] Iterate on landing page with gh integration (
Client = GH Organization
Project = GH Repo
Task = GH Branch
Notes = GH Commit message)
- [x] Add support for project-based pricing where a project is created, and we can clock in and track our time, but also the project has milestones that we create such as what's below. This should let us send these invoices at certain milestones. Maybe the milestone is a checklist or something and we mark it as complete and then it creates an invoice for us to review... something like that.
  - [x] Add `/projects` route + navigation entry with responsive Projects workspace UI
  - [x] Add project pricing modes (`hourly`/`milestone`) with total fee, hourly rate, and milestone template support
  - [x] Add milestone CRUD (create/edit/delete/reorder), completion modes (toggle/checklist), and completion invoice flow
  - [x] Add milestone invoice draft pipeline (optional session attachments + optional Mercury mirror creation)
  - [x] Persist project/client selection and include project-pricing/milestone metadata in history/PDF/backup paths
```
Initial Invoice: 50% of total project fee due upon signing this Agreement.
Milestone Payments:
10% due upon approval of Landing and homepage design.
10% due upon Core Prototype completed.
10% due upon LTI Integration completed
20% due upon launch of the website/app.
```

## Multi-user support
- [x] Rebased `feature/multi-user-support` onto latest `origin/main` and resolved conflicts
- [x] Added hosted auth route structure with public landing + protected tabs + dedicated sign-in route
- [x] Added callback redirect env support for Supabase auth (`EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL/PATH`)
- [x] Removed hosted-mode fallback to local SQLite for reads/writes (hosted path now fails fast on hosted errors)
- [x] Switched provider selection so hosted mode always uses hosted repository
- [x] Added hosted-focused tests for redirect config and no-fallback behavior
- [x] Installed `drizzle-zod` + `zod` and added hosted table-level typed schemas (`select/insert/update`)
- [x] Moved hosted table definitions to domain schema modules under `src/database/hosted/**/schema.ts`
- [x] Added hosted `relations.ts` and schema barrel export at `src/database/hosted/schema.ts`
- [x] Updated `drizzle.config.ts` schema glob to `./src/database/hosted/**/schema.ts`
- [x] Verified Drizzle integrity after split: `npm run db:generate` (no changes) + `npm run db:check` (pass)
- [x] Split hosted read/write DB logic into domain `queries.ts` modules
- [x] Rewired hosted app-facing exports off `src/database/hosted/repository.ts` to domain modules
- [x] Replaced monolithic `src/app/api/db/write+api.ts` with domain API routes:
  - `src/app/api/db/clients/[action]+api.ts`
  - `src/app/api/db/projects/[action]+api.ts`
  - `src/app/api/db/tasks/[action]+api.ts`
  - `src/app/api/db/milestones/[action]+api.ts`
  - `src/app/api/db/milestone-checklist/[action]+api.ts`
  - `src/app/api/db/sessions/[action]+api.ts`
  - `src/app/api/db/invoices/[action]+api.ts`
  - `src/app/api/db/invoice-session-links/[action]+api.ts`
- [x] Added shared write-route middleware/helpers for token auth, DB connection, and payload validation:
  - `src/app/api/db/_shared/auth.ts`
  - `src/app/api/db/_shared/db.ts`
  - `src/app/api/db/_shared/route.ts`
  - `src/app/api/db/_shared/parsers.ts`
- [x] Added domain write-query modules under `src/app/api/db/_queries/*`
- [x] Added local provider domain `queries.ts` wrappers under `src/database/local/<domain>/queries.ts` for parity with hosted module layout
- [x] Validation pass complete after split: `npm run typecheck` + `npm test`
- [x] Run `npm run db:migrate` against Supabase project and verify `drizzle.__drizzle_migrations` row is written
  - [x] Migration ledger baseline aligned and verified (`drizzle.__drizzle_migrations` count: `1`)
- [ ] Apply/verify RLS policies in Supabase SQL editor for all hosted tables (`auth_user_id = auth.uid()`)
- [ ] Finalize Supabase dashboard callback URLs for localhost + `https://time2pay.app/dashboard`
- [ ] Verify GitHub OAuth sign-in flow end-to-end post-migration (no loading loop, profile gate works)
- [ ] Run two-user hosted smoke test to confirm row isolation across reads and writes
- [ ] Split local `legacy.ts` internals into domain `queries.ts` implementations (keep `db.ts` facade unchanged)
- [x] Removed deprecated `src/database/hosted/repository.ts` after route and query split validated
- [ ] Deploy single Node app (Expo Router server output + API routes) on VPS at `https://time2pay.app`

- [ ] Accounting integrations
- [ ] Automated invoice reminders
- [ ] Financial dashboards

## Business Model: OSS + Hosted SaaS

### Pricing (Agreed Starter)
- [ ] `Free`: self-host, unlimited projects/clients, basic invoices
- [ ] `Pro $5/mo`: hosted, backups, recurring invoices, templates
- [ ] `Team $20/mo`: includes 2 users; +$5 per additional user; multi-user roles, approvals, export/reporting

### Mercury API Key Security (Hosted SaaS)
- [ ] Keep Mercury API keys server-side only (never in client JS, never in local profile UI)
- [ ] Encrypt keys at rest with envelope encryption (KMS-managed master key + per-record data key)
- [ ] Decrypt only inside backend route handlers when proxying Mercury requests
- [ ] Add key rotation flow (user can replace key, old encrypted value retired)
- [ ] Redact secrets in logs and add audit trail for key create/update/delete events

### Deployment Strategy Changes (Hosted SaaS Path)
- [ ] Split architecture into:
- [ ] `Self-host OSS`: current Expo Router server output + local SQLite (free tier)
- [ ] `Hosted SaaS`: managed Postgres, auth, backups, billing, and secure secrets store
- [ ] Add tenant model and data isolation for hosted users
- [ ] Add backup/restore jobs and disaster recovery checklist
- [ ] Add billing provider integration (Stripe) for Pro/Team plans

### Licensing Strategy
- [ ] Keep self-hostable core open source
- [ ] Keep hosted SaaS operations/private services proprietary (billing, managed backups, multi-tenant infra)
- [ ] Choose OSS license for core (default candidate: MIT) and document what is not included
- [ ] Add `LICENSE`, `CONTRIBUTING.md`, and `SECURITY.md` before public launch
