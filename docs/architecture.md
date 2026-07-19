# Architecture

## Overview

```
┌─────────────┐   HTTP (REST)    ┌─────────────┐
│   client    │ ───────────────▶ │   server    │
│ React + PWA │ ◀─────────────── │ Express +   │
│  (Vite)     │   WebSocket      │ Socket.io   │
└─────────────┘                  └──────┬──────┘
      │                                 │
      │ IndexedDB (Dexie)               │ SQLite (Drizzle ORM,
      │ offline scan queue              │ better-sqlite3)
      ▼                                 ▼
  survives dropped                 stocktake_sessions, products,
  WiFi on the phone                scan_events, expected quantities,
                                    variance snapshots
```

- **client/** — React + TypeScript + Vite, installable as a PWA. Talks to the server over REST
  for all writes and Socket.io for live updates.
- **server/** — Express + TypeScript. SQLite (via `better-sqlite3` + Drizzle ORM) as the
  single source of truth. Socket.io is used **only** for server → client fan-out — every
  state-changing write goes through REST first, so idempotency logic lives in exactly one place
  (`server/src/services/scan.service.ts`).
- **shared/** — TypeScript types and constants (DTOs, socket event names) imported by both
  workspaces, so the API contract is enforced by the compiler, not by convention.

## Why these choices

- **SQLite over a client-server DB** — this app is designed to run on one PC on a local
  network for a single stocktake session at a time. A file-based DB has zero setup, and
  `better-sqlite3`'s synchronous API keeps the service layer simple (no async ceremony around
  every query).
- **Socket.io for realtime, REST for writes** — reimplementing HTTP's retry/success/failure
  semantics on top of raw WebSocket messages is unnecessary complexity. Instead, every scan is
  a normal REST call; Socket.io just tells other connected clients "something changed, go
  refetch" or carries the already-computed new count.
- **`@ericblade/quagga2` over `html5-qrcode`/original `QuaggaJS`** — at the time this was built,
  `html5-qrcode` had no releases in ~2 years and was explicitly in maintenance mode, and the
  original `QuaggaJS` is unmaintained. `@ericblade/quagga2` is its actively maintained
  continuation and is purpose-built for 1D retail barcodes (EAN-13, UPC-A, Code128) — what's
  actually printed on products — rather than QR-code-oriented decoding.

## A real constraint you'll hit: camera access requires a "secure context"

Browsers only allow camera access (`getUserMedia`, which Quagga2 uses internally) on **secure
contexts**: `https://` origins, or `http://localhost`. A phone opening the app at
`http://192.168.x.x:5173` (the whole point of the "scan from your phone on the same WiFi"
design) is **not** a secure context, so **camera access will be blocked by default**.

This app deliberately stays plain HTTP for v1 rather than adding self-signed TLS certificates
to both the client dev server and the API server — that's real added complexity (cert
generation, trust prompts on the phone, `wss://` for Socket.io, mixed-content rules) for a
local-network tool. Instead:

- **Android Chrome**: visit `chrome://flags/#unsafely-treat-insecure-origin-as-secure` on the
  phone, add `http://<your-PC-LAN-IP>:5173`, relaunch Chrome. This is a real, standard Chrome
  developer flag made for exactly this scenario (testing camera/mic-requiring sites on a LAN
  device) — see the README for exact steps.
- **iOS Safari**: there is no equivalent flag; Apple does not expose a dev override for this.
  For an iPhone, either use the PC-webcam scanning path for your demo, tunnel the local server
  through something like `ngrok`/Cloudflare Tunnel (gives you a real HTTPS URL), or do a proper
  HTTPS deployment.

This is a genuine platform constraint, not a bug — but it will look like a broken feature if
you don't know about it going in, so it's called out here and in the README.

## Data model

See `server/src/db/schema.ts` for the source of truth. Summary:

- `products` — catalog, reusable across sessions, unique on `sku` and `barcode`.
- `stocktake_sessions` — one row per stocktake run (`draft` → `active` → `completed`).
- `session_expected_quantities` — the "system quantity" to compare against, scoped per
  session (not global — the same product can have a different expected count next time).
- `scan_events` — append-only. Live counts and the variance report are always derived by
  aggregating this table, never by a separately-maintained counter. Idempotency key:
  `(session_id, client_scan_id)`.
- `variance_report_snapshots` — a frozen JSON snapshot written when a session is marked
  `completed`, so a later scan correction doesn't silently rewrite historical reports.

See [docs/offline-sync.md](./offline-sync.md) for how offline scanning and sync work, and
[docs/api.md](./api.md) for the full REST/WebSocket surface.
