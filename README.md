# Barcode Stocktake App

A mobile-friendly stocktake tool: scan product barcodes with your phone camera (or a PC
webcam), watch live counts update on a dashboard in real time, and generate an
expected-vs-counted variance report at the end — replacing a pen-and-paper stocktake that
used to take days.

Built as a full-stack TypeScript portfolio project with a real backend, real tests, offline
support, and CI — not just a UI demo.

## Features

- 📷 **Scan with your phone or a PC webcam** — barcode detection via `@ericblade/quagga2`
  (EAN-13, UPC-A, Code128, and more).
- 🔴 **Live counts** — scan on your phone, watch the count update instantly on a dashboard
  open on your PC, via WebSocket.
- 📶 **Offline-first** — lose WiFi mid-aisle and keep scanning; scans queue on the device and
  sync automatically once you're back online, with no duplicates and no data loss.
- 📄 **CSV import + manual entry** — load expected quantities from a spreadsheet, or add/edit
  them by hand.
- 📊 **Variance report** — expected vs. counted vs. difference, viewable in the app or
  exportable as CSV.
- 📱 **Installable PWA** — add it to your phone's home screen like a native app.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite, installable PWA |
| Backend | Node.js + Express + TypeScript |
| Realtime | Socket.io |
| Database | SQLite via Drizzle ORM (`better-sqlite3`) |
| Offline storage | IndexedDB via Dexie.js |
| Barcode scanning | `@ericblade/quagga2` |
| Tests | Vitest (+ Supertest, React Testing Library, MSW) |
| Repo | npm workspaces monorepo (`client/`, `server/`, `shared/`) |

See [docs/architecture.md](./docs/architecture.md) for the reasoning behind these choices,
including **a real browser constraint you'll hit when scanning from a phone over plain
HTTP/LAN** — read that before you assume the camera is broken.

## Project structure

```
client/    React PWA — scanning UI, live dashboard, variance report
server/    Express API + Socket.io + SQLite
shared/    TypeScript types shared by both (the API contract)
sample-data/  Sample CSVs for demoing/import testing (clean, with-errors, restock-update)
docs/      Architecture, API reference, offline-sync design notes
```

## Getting started

### Prerequisites

- Node.js **18.18+** (Node 20 LTS recommended)
- A phone and PC on the **same WiFi network** (for the live phone-scanning demo)

### Install

```bash
npm install
cp .env.example server/.env
```

> `better-sqlite3` compiles a small native module on install. On Windows this normally just
> works via prebuilt binaries; if `npm install` fails on it, install the
> ["Desktop development with C++"](https://visualstudio.microsoft.com/downloads/) workload
> from Visual Studio Build Tools and re-run `npm install`.

### Set up the database and demo data

```bash
npm run db:generate -w server   # generates SQL migrations from server/src/db/schema.ts
npm run db:migrate              # applies them to server/data/stocktake.sqlite
npm run db:seed                 # seeds a demo session from sample-data/sample-products.csv
```

### Run it

```bash
npm run dev
```

This starts the shared-types watcher, the API server (default `http://localhost:4000`), and
the client (default `http://localhost:5173`) together. Open the client URL in your browser —
you now have a working app on your PC.

## Using it from your phone

The server logs your PC's LAN address on startup, e.g.:

```
Server listening on http://localhost:4000
On your phone (same WiFi network), open one of:
  http://192.168.1.42:4000
```

1. On your phone, open `http://<that-same-LAN-IP>:5173` (the **client's** port, 5173 — the
   client automatically talks to the API on port 4000 at the same address, no configuration
   needed).
2. Camera access requires what browsers call a "secure context" (`https://` or `localhost`) —
   a plain `http://192.168.x.x` address doesn't qualify by default, so the browser will block
   the camera. Work around it:
   - **Android Chrome**: go to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`,
     enter `http://<your-PC-LAN-IP>:5173`, tap **Enable**, then relaunch Chrome. This is a
     genuine Chrome developer flag intended for exactly this situation.
   - **iOS Safari**: there's no equivalent flag on iOS. Use the PC-webcam scanning path for a
     demo, or tunnel the server through `ngrok`/Cloudflare Tunnel for a real HTTPS URL.
3. Optionally, use your browser's "Add to Home Screen" — the app is a PWA and will launch
   full-screen like a native app.

Full explanation: [docs/architecture.md](./docs/architecture.md#a-real-constraint-youll-hit-camera-access-requires-a-secure-context).

## Typical workflow

1. On the PC dashboard, create a new session and **Import CSV** (try
   `sample-data/sample-products.csv`, a 30-item catalog across 5 categories) or add expected
   quantities manually.
2. Click **Start session**.
3. On your phone, open the session's **Scan** tab and start scanning. Counts update live on
   the PC dashboard as you go.
4. Click **Complete session** when done — this freezes a variance report snapshot.
5. View or export the **Report** tab (expected vs. counted vs. variance, CSV download).

### More sample data for testing

| File | Purpose |
|---|---|
| `sample-data/sample-products.csv` | Main demo catalog — 30 products across Beverages, Snacks, Grocery, Household, Stationery |
| `sample-data/sample-products-with-errors.csv` | 8 rows, 3 valid / 5 intentionally broken (missing barcode, non-numeric qty, negative qty, missing sku, missing qty) — import this to see the partial-import error report in action |
| `sample-data/sample-restock-update.csv` | Re-imports 3 existing barcodes with updated quantities/names plus 1 new item — demonstrates that CSV import **upserts** rather than duplicating |

## CRUD coverage

Every domain entity supports full create/read/update/delete, either directly or through a
deliberate, documented restriction that protects stocktake history from accidental data loss:

| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Products | `POST /api/products` | `GET /api/products`, `GET /api/products/:barcode` | `PATCH /api/products/:id` | `DELETE /api/products/:id` (blocked with `409` if referenced by any expected-quantity row or scan) |
| Sessions | `POST /api/sessions` | `GET /api/sessions`, `GET /api/sessions/:id` | `PATCH /api/sessions/:id` | `DELETE /api/sessions/:id` (only while `status: draft`) |
| Expected quantities | `POST /api/sessions/:id/expected-quantities`, CSV import | `GET /api/sessions/:id/expected-quantities` | `POST .../expected-quantities` again (upsert) | `DELETE /api/sessions/:id/expected-quantities/:productId` |
| Scan events | `POST /api/sessions/:id/scans(/batch)` | `GET /api/sessions/:id/scans`, `GET /api/sessions/:id/counts` | *(intentionally none — append-only; correct via void + rescan)* | `DELETE /api/sessions/:id/scans/:scanId` |

See [docs/api.md](./docs/api.md) for full request/response shapes.

## Testing

```bash
npm test        # server + client test suites (Vitest)
npm run lint     # ESLint, both workspaces
npm run typecheck
```

Server tests spin up an isolated in-memory SQLite database per test run (no shared state,
no dependency on migrations having been generated first). Client tests use `fake-indexeddb`
for the offline queue and mock the Quagga2 decode callback for scanner tests (no real camera
needed). See [docs/api.md](./docs/api.md) and [docs/offline-sync.md](./docs/offline-sync.md)
for what's covered and why.

## Known limitations / roadmap

- Local-network only for v1 — see [docs/architecture.md](./docs/architecture.md) for why, and
  what a cloud deploy would need.
- Single stocktake session "in flight" at a time is the assumed usage pattern; concurrent
  unrelated sessions work (each has its own room), but there's no user/auth model — anyone
  on the network can use the app.
- No end-to-end (Playwright) test suite yet — noted as a stretch goal.

## License

[MIT](./LICENSE)
