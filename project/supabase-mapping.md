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
| pricing_mode | pricing_mode | text check (hourly/milestone) |
| total_project_fee | total_project_fee | numeric(12,2) nullable |
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
| invoice_type | invoice_type | text check (hourly/milestone) |
| mercury_invoice_id | mercury_invoice_id | text nullable |
| payment_link | payment_link | text nullable |
| source_project_id | source_project_id | text nullable references projects(id) |
| source_project_name | source_project_name | text nullable |
| source_milestone_id | source_milestone_id | text nullable references project_milestones(id) |
| source_milestone_title | source_milestone_title | text nullable |
| source_milestone_amount_type | source_milestone_amount_type | text nullable check (percent/fixed) |
| source_milestone_amount_value | source_milestone_amount_value | numeric(12,2) nullable |
| source_milestone_completion_mode | source_milestone_completion_mode | text nullable check (toggle/checklist) |
| source_milestone_completed_at | source_milestone_completed_at | timestamptz nullable |
| source_session_link_mode | source_session_link_mode | text nullable check (context/billed) |
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

## project_milestones
| Local field | PostgreSQL column | Type |
| --- | --- | --- |
| id | id | text primary key |
| project_id | project_id | text references projects(id) |
| title | title | text |
| amount_type | amount_type | text check (percent/fixed) |
| amount_value | amount_value | numeric(12,2) |
| completion_mode | completion_mode | text check (toggle/checklist) |
| due_note | due_note | text nullable |
| sort_order | sort_order | integer |
| is_completed | is_completed | boolean |
| completed_at | completed_at | timestamptz nullable |
| created_at | created_at | timestamptz |
| updated_at | updated_at | timestamptz |
| deleted_at | deleted_at | timestamptz nullable |

## milestone_checklist_items
| Local field | PostgreSQL column | Type |
| --- | --- | --- |
| id | id | text primary key |
| milestone_id | milestone_id | text references project_milestones(id) |
| label | label | text |
| sort_order | sort_order | integer |
| is_completed | is_completed | boolean |
| completed_at | completed_at | timestamptz nullable |
| created_at | created_at | timestamptz |
| updated_at | updated_at | timestamptz |
| deleted_at | deleted_at | timestamptz nullable |

## invoice_session_links
| Local field | PostgreSQL column | Type |
| --- | --- | --- |
| id | id | text primary key |
| invoice_id | invoice_id | text references invoices(id) |
| session_id | session_id | text references sessions(id) |
| link_mode | link_mode | text check (context/billed) |
| created_at | created_at | timestamptz |
| updated_at | updated_at | timestamptz |

## Phase 2 Notes: GitHub OAuth Integration
- Add `github_integrations` table: `id`, `user_id`, `github_user_id`, `access_token` (encrypted), `repo_full_name`, `created_at`
- Add `user_id` FK to sessions for multi-user support
- Enable Supabase Auth with GitHub provider
- Automatic commit-to-session linking via GitHub webhooks
