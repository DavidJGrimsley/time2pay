# Time2Pay — TODO

## Current Status
- Branch: `work`
- Phase focus: Phase 1 (Web, local-first)

## Immediate Next Actions

### 1) Bootstrap Expo Web App Shell
- [ ] Create Expo app structure at repo root
- [ ] Add screen scaffolding (`Dashboard`, `Sessions`, `Invoices`)
- [ ] Add component scaffolding (`Timer`, `SessionList`, `InvoiceBuilder`)
- [ ] Ensure app runs with `expo start --web`

### 2) Complete Local Data Layer (`expo-sqlite`)
- [x] Define schema and typed helpers in `src/database/db.ts`
- [x] Add lightweight validation around date/time and duration math
- [ ] Add migration/versioning strategy for schema updates
- [ ] Add tests (or executable validation script) for core DB operations

### 3) Invoice Pipeline
- [ ] Build invoice service for total-hours and total-amount calculations
- [ ] Add jsPDF invoice export
- [ ] Add PayPal payment link formatting/validation
- [ ] Link selected sessions to invoice record

## Phase 2 Preparation
- [ ] Add sync-friendly columns where needed (`created_at`, `updated_at`, optional `deleted_at`)
- [ ] Define API contract for sessions/invoices
- [ ] Map local model fields to PostgreSQL/Supabase schema

## Longer-Term
- [ ] Multi-user support
- [ ] Cloud-hosted option
- [ ] Accounting integrations
- [ ] Automated invoice reminders
- [ ] Financial dashboards
