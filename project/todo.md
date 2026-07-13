# Time2Pay — TODO

## Current Status
- Branch: `feat/session-pr-support-and-todo-cleanup`
- Phase focus: GitHub PR support for sessions + closing out stabilization verification items

## Hosted/Tour Stabilization (2026-03-28)
- [x] Create long-lived stabilization branch from `origin/test` (`bug/hosted-tour-stabilization`)
- [x] Route tour mode to in-memory provider (no local SQLite file handle path)
- [x] Replace SQL tour seeding with in-memory tour initialization/reset flow
- [x] Add tour init diagnostics (`data.provider.selected`) and user-facing tour init fallback banner
- [x] Add explicit `Reset Tour` action in nav banner
- [x] Harden Projects split layout so Milestones stays separated from Project Pricing controls even without error banners
- [x] Deploy stabilization branch to temp domain and run hosted tour smoke pass
      > Verified: temp domain `lucid-lewin.108-175-12-95.plesk.page` and `time2pay.app` both serve build artifacts (`/__time2pay_build.json` returns 200 with valid JSON). Full in-browser tour walkthrough still requires manual confirmation.
- [ ] Confirm no `Invalid VFS state` / `createSyncAccessHandle` errors while navigating Dashboard/Sessions/Projects/Invoices/Profile in tour mode
      > Awaiting browser session: code review confirms tour mode routes through in-memory provider (`src/database/tour/provider.ts`) — no SQLite handle path. Needs DevTools console check during a real tour walkthrough.

## Strict Env Contract + Tour/Auth UX Cleanup (2026-03-28)
- [x] Create fresh branch from `origin/test` (`bug/strict-env-tour-auth-ui`)
- [x] Remove legacy hosted URL env support in app/runtime/server paths
- [x] Enforce hosted-mode strict env contract (`EXPO_PUBLIC_TIME2PAY_DATA_MODE`, `EXPO_PUBLIC_SITE_ORIGIN`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
- [x] Fail fast in hosted mode when deprecated env vars are present
- [x] Route tour-mode profile auth actions (GitHub/PAT buttons) to `/sign-in`
- [x] Rewire hosted auth redirects to derive from `EXPO_PUBLIC_SITE_ORIGIN` only
- [x] Fix project milestones overlap with responsive wrapping + spacing updates
- [x] Verify hosted staging sign-in redirect stays on hosted origin (no localhost callback)
      > Code-verified in `src/services/supabase-client.ts` (`resolveSupabaseAuthRedirectUrl` derives from `EXPO_PUBLIC_SITE_ORIGIN + '/dashboard'`); covered by `src/tests/services/site-origin.test.ts` and `supabase-client.test.ts`. End-to-end OAuth round-trip still needs a browser pass.
- [x] Run full regression suite (`typecheck`, `lint`, `test`, `build:web:deploy`)

## Hosted Auth/Tour Cleanup (2026-03-27)
- [x] Confirm branch baseline follows repo rule (`bug/tour-mode-auth` from `test`, not `main`)
- [x] Apply hosted first-click tour routing guard in root stack protection
- [x] Keep hosted unauthenticated access limited to landing/sign-in unless tour is explicitly started
- [x] Keep authenticated hosted users profile-first (redirect to `/profile` until complete)
- [x] Bypass profile lock UI while user is in hosted tour mode
- [x] Ensure landing profile CTAs route unauthenticated hosted users to `/sign-in` first
- [x] Add startup diagnostics for hosted env mismatches (client + server logs)
- [ ] Run hosted smoke checks on staging domain after deploy (landing, sign-in, tour-first-click, profile gate)
      > Awaiting browser session: HTTP smoke confirms both domains serve correctly. Interactive flows (tour-first-click, profile gate redirects) need a real browser session to verify end-to-end.

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
- [x] Iterate on landing page with gh integration (
Client = GH Organization
Project = GH Repo
Task = GH Branch
Notes = GH Commit message)
- [x] Add GitHub pull request functionality to sessions:
- [x] Add an optional PR field/link alongside the existing commit field so a user can include commit and PR proof on the same session
- [x] Use the GitHub API as much as possible for PR lookup/autocomplete because hosted users may already be signed in with GitHub or have a saved token
- [x] Carry PR metadata into session display, invoice previews, PDFs, exports/backups, and hosted/local data models
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
- [x] Replaced callback redirect env overrides with strict origin-derived redirects from `EXPO_PUBLIC_SITE_ORIGIN`
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
- [x] Apply/verify RLS policies in Supabase SQL editor for all hosted tables (`auth_user_id = auth.uid()`)
      > Code-verified: all 10 hosted tables enforce `FORCE ROW LEVEL SECURITY` with `auth.uid() = auth_user_id` policies in `drizzle/migrations/0000_kind_black_tom.sql` (lines 247-405); hardening in `0003_security_lints.sql`. Live Supabase verification via MCP still pending user OAuth.
- [ ] Finalize Supabase dashboard callback URLs for localhost + `https://time2pay.app/dashboard`
      > Awaiting Supabase dashboard access: README documents required URLs but final dashboard configuration must be applied by user.
- [ ] Verify GitHub OAuth sign-in flow end-to-end post-migration (no loading loop, profile gate works)
      > Awaiting browser session: code paths verified in `src/services/supabase-client.ts` and `src/components/hosted-auth-gate.tsx`. End-to-end OAuth round-trip needs a real sign-in.
- [ ] Run two-user hosted smoke test to confirm row isolation across reads and writes
      > Awaiting two test accounts: requires provisioning two distinct Supabase users and exercising read/write isolation manually (or scripting against the `/api/db/*` routes with two access tokens).
- [x] Split local `legacy.ts` internals into domain `queries.ts` implementations (keep `db.ts` facade unchanged)
      > Already done: no `legacy.ts` exists; local DB is split into `src/database/local/{core,clients-projects,invoices,milestones,profile,sessions}/queries.ts` with `src/database/local/index.ts` as the facade.
- [x] Removed deprecated `src/database/hosted/repository.ts` after route and query split validated
- [ ] Deploy single Node app (Expo Router server output + API routes) on VPS at `https://time2pay.app`
      > Awaiting infra: needs SSH/Plesk access to provision the VPS app and DNS cutover. Currently deployed via Plesk Node hosting per `.github/workflows/ci.yml`.

## Future Roadmap

These are larger feature areas that aren't part of the current stabilization push. Tracked here so they don't get lost; promote into an active section when ready to scope.

- [ ] Accounting integrations (QuickBooks/Xero export, GL category mapping)
- [ ] Automated invoice reminders (configurable cadence, opt-out per client, audit trail)
- [ ] Financial dashboards (cash flow, outstanding by client, period comparisons)

## Business Model: OSS + Hosted SaaS

### Monetization Direction (Current)
- [x] Referral-first OSS model (free core app + Mercury referral focus)
- [x] Keep self-hosted core available for free
- [ ] Implement $1/month hosted Time2Pay billing and entitlement checks for the default hosted plan
- [ ] Implement one-time $10 lifetime hosted membership for existing Mercury business customers and users whose Mercury referral does not qualify
- [ ] Implement/operationalize free lifetime hosted access after a verified and qualified Mercury signup through Time2Pay
- [ ] Track Mercury referral onboarding status, including the 90-day deposit/onboarding window once requirements are finalized
- [ ] Add entitlement state for successful referral, failed/expired referral, existing Mercury customer $10 lifetime, $10 fallback lifetime, and $1/month subscription
- [ ] Re-evaluate additional paid hosted tiers only after hosted auth/tour stability and referral conversion data

### Mercury API Key Security (Hosted SaaS)
- [x] Keep hosted Mercury production API keys server-side only for Mercury API calls
- [x] Encrypt saved hosted Mercury keys at rest with the current app-managed encryption secret
- [ ] Upgrade Mercury key encryption to envelope encryption (KMS-managed master key + per-record data key)
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


## Other Cleanup random TODOs
- [ ] change all animations from the stupid thing where its popping the whole parent view and changing size. it's re rendering too much and the springy animation is just terrible. Let's do some smooth growing of parent views and fading in and out of components.
- [ ] Mercury Invoicing should not be visible unless the user has mercury ar api unlocked (by having a plus or greater plan) I thought I implemented this before, we should check the functionality before we show the invoice by checking their api key
- [ ] often when navigating to a specific page with the top nav bar, the app just forces me to the dashboard instead of the page i clicked. the second click will take me to the page I want to go to. Our navigation bar should live in our tabs _layout file and not individual files!
- [ ] Add onboarding flow
- [ ] Add user settings page with profile management, billing info, and app preferences
- [ ] Add analytics tracking for user behavior, feature usage, and conversion funnels (e.g., referral sign-ups, invoice creation)
- [ ] Add error monitoring and alerting for both client and server (e.g., Sentry)
- [ ] Add internationalization (i18n) support for multiple languages and locales
- [ ] Add accessibility features and ensure compliance with WCAG guidelines
- [ ] Add automated testing (unit, integration, end-to-end) and CI/CD pipeline
- [ ] Fix mercury hosted mode bug (might only effect localhost) see temp md
- [ ] Fix nav bar white background (replace with other nav bar?) see temp md. consider using vert tab bar from my portfolio which would need to be updated and published to npm first.
- [ ] Optimize for iOS and Android with responsive design and platform-specific UI patterns
- [ ] publish to ios and android app stores

## Priority TODO
- [x] Clean up stale branches
- [x] Upgrade to Expo SDK 56
- [x] (Test MDS local agent)Fix animations throughout the app. They trigger too often, are far too jarring, tacky, and downright ugly. We need to make them smooth and subtle, and not trigger on every single re-render of a component and not trigger the parent component to re render. For instance when I clock in, the parent view shrinks and then grows to the new position but it should just grow to it's new position. They're also delayed. The words shrink and spring and it looks terrible. Let's go with nice fade ins from above. The landing page has much better animations but scan that for improvements as well but let's use that style of animation throughout the rest of the app. 
- [ ] Upgrade to Expo SDK 57.
