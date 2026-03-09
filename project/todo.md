# Time2Pay — TODO

## Current Status
- Branch: `work`
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

## Random
- [x] Add ability edit sessions, make create manual session more robust like clock in, group sessions better(by week and client)
- [x] Light/dark mode
- [x] Revise copy icons script and run it to move icons over
- [x] set up pwa with automatic updates and persisting data
- [x] Revamp invoices to have user data in from section with optional branding, further format fixes
- [x] A gate on the entire dashboard buttons and interactivity to ensure the user has filled out the profile screen first
- [ ] Move all alerts from inline style to system alert window because inline alerts are not obvious enough and can lead to user frustration 
- [ ] Export & import user data including all profile, clients, time tracked, etc.
- [ ] Refine github integration - when adding the commit message to the notes, there is no indication that this comes from github or is associated with a commit or anything. I want the whoever looks at the invoice to be able to click a link for each project that takes them to the github commit for that session. the task being the branch name means this could be autofilled for the user. the user should be able to start create a client, project, and task, all from one github link. this should be a separate button on the dashboard maybe so the user can see a modal open that explains the flow. let's also explore sign in with github options but idk if that can be done self-hosted.
- [ ] Make a landing page that explains how the app works and that it's best if you have mercury banking with at least their 'Plus' plan to take advantage of the invoicing but that there is still some mercury functionality either way. Formatting: if the page were split into thirds, it should have our logo really big centered on the left third, and a big display font title of our app and caption, then the user will scroll to see the rest of how the app works, then they will see the let's get started button at the bottom. It shouldn't be very long, like 3 pages (of full width content, please use responsive styling so it would be of course longer on smaller screens.)
- [ ] Make comprehensive mercury-api-ui npm package. could we do a sign in with mercury in the future? or only if they partnered with us.

## Longer-Term
- [ ] Multi-user support
- [ ] Cloud-hosted option
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
