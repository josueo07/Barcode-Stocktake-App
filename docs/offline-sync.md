# Offline-First Scanning

A warehouse WiFi network dropping out mid-stocktake is a realistic failure mode, so scanning
is designed to survive it.

## Flow

1. The camera decodes a barcode. Repeat detections of the same code within ~1.5s (the camera
   fires many frames per physical scan) are collapsed into one logical scan by
   `ScanDebouncer` (`client/src/components/scanner/scanDebounce.ts`).
2. A `clientScanId` (UUID v4, generated with the `uuid` package — deliberately not
   `crypto.randomUUID()`, which itself requires a secure context and would silently break on a
   LAN `http://` connection) is generated at capture time and never changes on retry. This is
   the permanent idempotency key for that physical scan.
3. The scan is written to IndexedDB (via Dexie, `client/src/db/offlineQueue.ts`) **first**,
   unconditionally — online or offline. The UI updates immediately from that local write, so
   nothing is lost if the network drops a moment later.
4. `useOfflineSync` (`client/src/hooks/useOfflineSync.ts`) flushes pending rows to
   `POST /api/sessions/:id/scans/batch` in batches, triggered on: app start, the browser
   `online` event, a periodic interval while online, and immediately after each new scan.
5. `useOnlineStatus` doesn't trust the browser's `online`/`offline` events alone — those only
   reflect the network interface, not whether the PC's server is actually reachable. It layers
   a periodic `GET /api/health` heartbeat on top.
6. The server dedupes on `(session_id, client_scan_id)` — see `recordScan` in
   `server/src/services/scan.service.ts`. A retried flush of an already-recorded scan comes
   back as `duplicate`, not an error, so retrying a batch is always safe.
7. Once persisted (whether scanned live or synced minutes later), the server broadcasts
   `session:count-update` over Socket.io to everyone viewing that session.
8. Each queued scan is marked `pending` → `synced` or `failed` (with the server's error
   message attached) in IndexedDB, and that status is shown in the "recent scans" list on the
   phone — no silent failures.

## Why idempotency is per-scan, not per-barcode

Two different scans of the same barcode are two different `scan_events` — that's literally
what "counted quantity" means. Deduping is scoped to `clientScanId` specifically so that
retrying a *submission* is safe, without accidentally collapsing two genuinely separate
physical scans of the same product into one.
