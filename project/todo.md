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
- [x] Incubate Mercury work inside this `time2pay` branch using npm workspaces
- [x] Create `@mrdj/mercury` package scaffold in `packages/mercury`
- [x] Create `@mrdj/mercury-ui` package scaffold in `packages/mercury-ui`
- [x] Add workspace scripts for Mercury build/typecheck/test at repo root

### Mercury SDK (`@mrdj/mercury`) - Completed
- [x] Implement `createMercuryClient(config)` with environment/baseUrl/fetch/retry/logger options
- [x] Implement resource groups: `accounts`, `transactions`, `recipients`, `sendMoney`, `transfers`, `ar.customers`, `ar.invoices`, `webhooks`
- [x] Add typed errors and request safety wrappers
- [x] Add idempotency key helpers and enforce keys for money movement methods
- [x] Add utilities from app logic: date validation, line-item building, best checking account selection
- [x] Add unit tests for client, pagination, utils, and webhook parsing/signature
- [x] Add sandbox contract-test suite scaffold with opt-in env flags

### Mercury UI (`@mrdj/mercury-ui`) - Completed
- [x] Add primitives/components: logo, badge, card, status notice, account select, recipient picker
- [x] Add workflow components: `InvoiceWizard` and `SendMoneyForm`
- [x] Add idempotency help tooltip (`i` hover/tap) in Send Money form
- [x] Add empty-state messaging when no recipients are available
- [x] Expand invoice wizard to maximal controls:
- [x] customer + routing fields
- [x] amount/currency
- [x] invoice and due dates
- [x] send-email option
- [x] ACH/card/real-account toggles
- [x] CC emails
- [x] structured line items with add/remove and validation
- [x] Fix responsive overflow issues in wizard layouts for smaller widths

### App Integration - Completed
- [x] Wire Mercury proxy actions in `src/app/api/mercury+api.ts`
- [x] Replace app-side Mercury calls to use workspace packages
- [x] Add `Payments` route and tab
- [x] Add `MercurySendMoneyWorkflow` screen integration
- [x] Add `MercuryInvoiceWorkflow` on invoices page
- [x] Keep legacy `InvoiceBuilder` active during incubation
- [x] Update bank page to Mercury-styled card and remove manual refresh button


### App Integration - Next
- [x] Handle legacy `InvoiceBuilder` and Mercury advanced wizard into a single unified invoice creation flow (specification in the next few todo items)
- [x] Create 'Time2PayMercuryInvoiceBuilder' which is branded with Mercury like the mercury invoice builder but has the functionality of our invoice builder (made from sessions - like our generic invoice builder)
- [x] Strip mercury integration from our generic invoice builder.
- [x] Use the presence of a mercury key ('check connection') to conditionally render a generic invoice builder (basically the one we've been using that lets you download a pdf) or the 'Time2PayMercuryInvoiceBuilder'
- [x] Leave the Mercury invoice builder in the mercury package for other developers, it should now have 3 mercury invoice builders, a simple one with just a few options, the super complex one that we can see now, and the Time2PayMercuryInvoiceBuilder, which is a blend of the super complex one(leave all those features and brandin in!) and the generic one(built from session data)
- [x] Add inline mapping from session/task groups to editable Mercury line items before submit
- [ ] Add recipient creation/edit flow from inside app (instead of Mercury dashboard-only)
- [ ] Add explicit AR beta warnings and guardrails in UI for risky actions
- [ ] Add mobile-first polish pass for all Mercury forms (spacing, keyboard, overflow, focus states)

### Testing and Reliability - Next
- [ ] Run live Mercury sandbox contract tests with real sandbox credentials and fixtures
- [ ] Add CI job for workspace typecheck/lint/tests + optional contract-test gate
- [ ] Add integration tests for `/api/mercury` action handlers
- [ ] Add smoke tests for Payments and Invoices routes on web

### Extraction Readiness - Next
- [ ] Add Changesets entries and versioning policy for `@mrdj/mercury` and `@mrdj/mercury-ui`
- [ ] Freeze public APIs and document migration guarantees
- [ ] Extract `packages/mercury` and `packages/mercury-ui` to standalone repo when app integration is stable
- [ ] Swap app from workspace `file:` deps to published npm deps without redesign

### Future Exploration
- [ ] Evaluate Sign in with Mercury (OAuth/partnership requirements and feasibility)


## Longer-Term
- [ ] Iterate on landing page with gh integration (
Client = GH Organization
Project = GH Repo
Task = GH Branch
Notes = GH Commit message)
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
