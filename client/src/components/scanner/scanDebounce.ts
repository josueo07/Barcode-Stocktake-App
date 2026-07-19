import { SCAN_DEBOUNCE_MS } from '@barcode-stocktake/shared';

/**
 * A camera decoder fires multiple detections per physical scan while the barcode stays in
 * frame. This collapses repeat decodes of the same code within a short window into one event.
 */
export class ScanDebouncer {
  private lastSeen = new Map<string, number>();

  constructor(private readonly windowMs: number = SCAN_DEBOUNCE_MS) {}

  shouldAccept(barcode: string, now: number = Date.now()): boolean {
    const last = this.lastSeen.get(barcode);
    if (last !== undefined && now - last < this.windowMs) {
      return false;
    }
    this.lastSeen.set(barcode, now);
    return true;
  }
}
