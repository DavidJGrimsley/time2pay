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
- [ ] Light/dark mode
- [ ] Revise copy icons script and run it to move icons over
- [ ] set up pwa with automatic updates and persisting data
- [x] Revamp invoices to have user data in from section with optional branding, further format fixes
- [ ] move all alerts from inline style to system alert window - inline alerts are not obvious enough and can lead to user frustration 
- [ ] Export & import user data including all profile, clients, time tracked, etc.
- [ ] Make comprehensive mercury-api-ui npm package

## Longer-Term
- [ ] Multi-user support
- [ ] Cloud-hosted option
- [ ] Accounting integrations
- [ ] Automated invoice reminders
- [ ] Financial dashboards
