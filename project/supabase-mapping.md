# Local Model -> PostgreSQL/Supabase Mapping

## sessions
| Local field | PostgreSQL column | Type |
| --- | --- | --- |
| id | id | text primary key |
| client | client | text |
| start_time | start_time | timestamptz |
| end_time | end_time | timestamptz nullable |
| duration | duration | integer nullable |
| notes | notes | text nullable |
| invoice_id | invoice_id | text nullable references invoices(id) |
| created_at | created_at | timestamptz |
| updated_at | updated_at | timestamptz |
| deleted_at | deleted_at | timestamptz nullable |

## clients
| Local field | PostgreSQL column | Type |
| --- | --- | --- |
| id | id | text primary key |
| name | name | text |
| email | email | text nullable |
| hourly_rate | hourly_rate | numeric(12,2) |
| created_at | created_at | timestamptz |
| updated_at | updated_at | timestamptz |
| deleted_at | deleted_at | timestamptz nullable |

## invoices
| Local field | PostgreSQL column | Type |
| --- | --- | --- |
| id | id | text primary key |
| client_id | client_id | text references clients(id) |
| total | total | numeric(12,2) |
| status | status | text check (draft/sent/paid/overdue) |
| mercury_invoice_id | mercury_invoice_id | text nullable |
| payment_link | payment_link | text nullable |
| created_at | created_at | timestamptz |
| updated_at | updated_at | timestamptz |
| deleted_at | deleted_at | timestamptz nullable |
