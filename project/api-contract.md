# Time2Pay API Contract Draft (Phase 2 Prep)

## Sessions

### Session object
```json
{
  "id": "string",
  "client": "string",
  "start_time": "ISO-8601 string",
  "end_time": "ISO-8601 string | null",
  "duration": "integer seconds | null",
  "notes": "string | null",
  "invoice_id": "string | null",
  "created_at": "ISO-8601 string",
  "updated_at": "ISO-8601 string",
  "deleted_at": "ISO-8601 string | null"
}
```

### Endpoints
- `GET /v1/sessions`
- `POST /v1/sessions/start`
- `POST /v1/sessions/:id/stop`
- `POST /v1/sessions/manual`
- `PATCH /v1/sessions/:id/invoice`

## Clients

### Client object
```json
{
  "id": "string",
  "name": "string",
  "email": "string | null",
  "hourly_rate": "number",
  "created_at": "ISO-8601 string",
  "updated_at": "ISO-8601 string",
  "deleted_at": "ISO-8601 string | null"
}
```

### Endpoints
- `GET /v1/clients`
- `POST /v1/clients`
- `PATCH /v1/clients/:id`

## Invoices

### Invoice object
```json
{
  "id": "string",
  "client_id": "string",
  "total": "number",
  "status": "draft | sent | paid | overdue",
  "invoice_type": "hourly | milestone",
  "mercury_invoice_id": "string | null",
  "payment_link": "string | null",
  "source_project_id": "string | null",
  "source_project_name": "string | null",
  "source_milestone_id": "string | null",
  "source_milestone_title": "string | null",
  "source_milestone_amount_type": "percent | fixed | null",
  "source_milestone_amount_value": "number | null",
  "source_milestone_completion_mode": "toggle | checklist | null",
  "source_milestone_completed_at": "ISO-8601 string | null",
  "source_session_link_mode": "context | billed | null",
  "created_at": "ISO-8601 string",
  "updated_at": "ISO-8601 string",
  "deleted_at": "ISO-8601 string | null"
}
```

### Endpoints
- `GET /v1/invoices`
- `POST /v1/invoices`
- `POST /v1/invoices/:id/export`
- `PATCH /v1/invoices/:id/status`

## Project Pricing (Milestones)

### Project object (extended)
```json
{
  "id": "string",
  "client_id": "string",
  "name": "string",
  "github_repo": "string | null",
  "pricing_mode": "hourly | milestone",
  "total_project_fee": "number | null",
  "created_at": "ISO-8601 string",
  "updated_at": "ISO-8601 string",
  "deleted_at": "ISO-8601 string | null"
}
```

### Milestone object
```json
{
  "id": "string",
  "project_id": "string",
  "title": "string",
  "amount_type": "percent | fixed",
  "amount_value": "number",
  "completion_mode": "toggle | checklist",
  "due_note": "string | null",
  "sort_order": "integer",
  "is_completed": "0 | 1",
  "completed_at": "ISO-8601 string | null",
  "created_at": "ISO-8601 string",
  "updated_at": "ISO-8601 string",
  "deleted_at": "ISO-8601 string | null"
}
```

### Milestone checklist item object
```json
{
  "id": "string",
  "milestone_id": "string",
  "label": "string",
  "sort_order": "integer",
  "is_completed": "0 | 1",
  "completed_at": "ISO-8601 string | null",
  "created_at": "ISO-8601 string",
  "updated_at": "ISO-8601 string",
  "deleted_at": "ISO-8601 string | null"
}
```

### Invoice-session link object
```json
{
  "id": "string",
  "invoice_id": "string",
  "session_id": "string",
  "link_mode": "context | billed",
  "created_at": "ISO-8601 string",
  "updated_at": "ISO-8601 string"
}
```

### Endpoints
- `PATCH /v1/projects/:id/pricing`
- `GET /v1/projects/:id/milestones`
- `POST /v1/projects/:id/milestones`
- `PATCH /v1/milestones/:id`
- `POST /v1/milestones/:id/checklist-items`
- `PATCH /v1/milestone-checklist-items/:id`
- `POST /v1/milestones/:id/complete-and-invoice`
