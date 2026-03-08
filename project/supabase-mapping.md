# Local Model -> PostgreSQL/Supabase Mapping

## sessions
| Local field | PostgreSQL column | Type |
| --- | --- | --- |
| id | id | text primary key |
| client | client | text |
| client_id | client_id | text nullable references clients(id) |
| project_id | project_id | text nullable references projects(id) |
| task_id | task_id | text nullable references tasks(id) |
| start_time | start_time | timestamptz |
| end_time | end_time | timestamptz nullable |
| duration | duration | integer nullable |
| notes | notes | text nullable |
| commit_sha | commit_sha | text nullable |
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
| github_org | github_org | text nullable |
| created_at | created_at | timestamptz |
| updated_at | updated_at | timestamptz |
| deleted_at | deleted_at | timestamptz nullable |

## projects
| Local field | PostgreSQL column | Type |
| --- | --- | --- |
| id | id | text primary key |
| client_id | client_id | text references clients(id) |
| name | name | text |
| github_repo | github_repo | text nullable |
| created_at | created_at | timestamptz |
| updated_at | updated_at | timestamptz |
| deleted_at | deleted_at | timestamptz nullable |

## tasks
| Local field | PostgreSQL column | Type |
| --- | --- | --- |
| id | id | text primary key |
| project_id | project_id | text references projects(id) |
| name | name | text |
| github_branch | github_branch | text nullable |
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

## session_breaks
| Local field | PostgreSQL column | Type |
| --- | --- | --- |
| id | id | text primary key |
| session_id | session_id | text references sessions(id) |
| start_time | start_time | timestamptz |
| end_time | end_time | timestamptz nullable |
| created_at | created_at | timestamptz |
| updated_at | updated_at | timestamptz |
| deleted_at | deleted_at | timestamptz nullable |

## Phase 2 Notes: GitHub OAuth Integration
- Add `github_integrations` table: `id`, `user_id`, `github_user_id`, `access_token` (encrypted), `repo_full_name`, `created_at`
- Add `user_id` FK to sessions for multi-user support
- Enable Supabase Auth with GitHub provider
- Automatic commit-to-session linking via GitHub webhooks
