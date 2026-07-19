# API Reference

Base URL: `http://<host>:4000` (see `server/.env` — `PORT`). All request/response bodies are
JSON except CSV import (`multipart/form-data`) and the CSV export endpoint.

Errors are always `{ "error": { "message": string, "details"?: unknown } }` with an appropriate
HTTP status code (400 validation, 404 not found, 409 conflict, 500 unexpected).

## Sessions

| Method & Path | Body | Purpose |
|---|---|---|
| `POST /api/sessions` | `{ name, notes? }` | Create a session (starts as `draft`) |
| `GET /api/sessions` | — | List all sessions |
| `GET /api/sessions/:id` | — | Get one session |
| `PATCH /api/sessions/:id` | `{ name?, notes?, status? }` | Update a session; setting `status: "completed"` freezes a variance report snapshot |
| `POST /api/sessions/:id/import-csv` | multipart, field `file` | Bulk import expected quantities from CSV (columns: `sku,barcode,name,expected_qty[,category]`) |
| `GET /api/sessions/:id/expected-quantities` | — | List expected quantities for a session |
| `POST /api/sessions/:id/expected-quantities` | `{ barcode, expectedQty, sku?, name? }` | Add/update one expected quantity manually; `sku`+`name` required only if the barcode is new |

## Products

| Method & Path | Purpose |
|---|---|
| `GET /api/products?search=` | List/search the product catalog |
| `GET /api/products/:barcode` | Look up a product by barcode |
| `POST /api/products` | Create a product manually |

## Scans

| Method & Path | Body | Purpose |
|---|---|---|
| `POST /api/sessions/:id/scans` | `ScanSubmission` | Submit one scan (online path) |
| `POST /api/sessions/:id/scans/batch` | `{ scans: ScanSubmission[] }` | Submit queued scans (offline-sync flush); dedupes by `clientScanId`, max 50/request |
| `GET /api/sessions/:id/counts` | — | Live counted-vs-expected per barcode |
| `DELETE /api/sessions/:id/scans/:scanId` | — | Void/correct an erroneous scan |
| `GET /api/sessions/:id/variance-report` | — | Expected vs. counted vs. variance |
| `GET /api/sessions/:id/variance-report/export` | — | Same report as a CSV download |

`ScanSubmission`: `{ clientScanId: string (uuid), barcode: string, quantity?: number, scannedAt: string (ISO), deviceLabel?: string }`

## Misc

| Method & Path | Purpose |
|---|---|
| `GET /api/health` | Uptime healthcheck, also used as the offline-sync connectivity heartbeat |

## WebSocket (Socket.io)

Connect to the same host/port as the API. All state-changing writes go through REST above —
these events are server → client notifications only.

| Direction | Event | Payload | When |
|---|---|---|---|
| client → server | `join-session` | `sessionId: number` | On mount, to receive updates for that session |
| client → server | `leave-session` | `sessionId: number` | On unmount |
| server → client | `session:count-update` | `{ sessionId, productId, barcode, newCount, lastScan }` | After any scan is recorded or voided |
| server → client | `session:status-changed` | `{ sessionId, status }` | Session status transitions |
| server → client | `session:expected-qty-updated` | `{ sessionId }` | After a CSV import or manual expected-quantity edit (listeners refetch) |

See `shared/src/constants.ts` for the canonical event name/payload types.
