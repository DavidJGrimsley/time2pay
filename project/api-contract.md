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
  "mercury_invoice_id": "string | null",
  "payment_link": "string | null",
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
