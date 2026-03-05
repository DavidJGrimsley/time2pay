# Time2Pay — Project Info

## Vision
Time2Pay is an open-source, self-hosted time tracking and invoicing system for freelancers/contractors.

Core principles:
- Local-first architecture
- Open source
- Self-hostable
- Minimal dependencies

## Product Phases

### Phase 1 — Web App (Local First)
- Stack: Expo, React Native, Expo Web, `expo-sqlite`
- Architecture: Expo Web app + local SQLite (no backend)
- Goal: single-user local workflow for sessions and invoicing

### Phase 2 — Mobile + Sync
- Stack: Expo React Native, Node.js API, PostgreSQL
- Architecture: Mobile app -> Time2Pay API -> PostgreSQL
- Goal: mobile tracking and cross-device sync

### Phase 3 — Desktop
- Options: Electron or Tauri (preferred)
- Architecture: Desktop app -> Time2Pay API -> PostgreSQL

## Integrations
- Mercury API (via backend only): invoice generation, payment links, bank info, transaction monitoring
- PayPal link support in Phase 1 invoice output
- Future: Stripe/Mercury payment expansion

## Data Models (Planned)

### Sessions
- id
- client
- start_time
- end_time
- duration
- notes
- invoice_id

### Clients
- id
- name
- email
- hourly_rate

### Invoices
- id
- client_id
- total
- status
- mercury_invoice_id
- payment_link

## MVP Scope
- Timer
- Session tracking (automatic + manual)
- Invoice creation
- PDF export
- Payment link generation
