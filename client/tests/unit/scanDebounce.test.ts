import { describe, expect, it } from 'vitest';
import { ScanDebouncer } from '../../src/components/scanner/scanDebounce';

describe('ScanDebouncer', () => {
  it('accepts the first scan of a barcode', () => {
    const debouncer = new ScanDebouncer(1500);
    expect(debouncer.shouldAccept('123', 0)).toBe(true);
  });

  it('rejects a repeat scan of the same barcode within the debounce window', () => {
    const debouncer = new ScanDebouncer(1500);
    debouncer.shouldAccept('123', 0);
    expect(debouncer.shouldAccept('123', 500)).toBe(false);
  });

  it('accepts a repeat scan of the same barcode once the debounce window elapses', () => {
    const debouncer = new ScanDebouncer(1500);
    debouncer.shouldAccept('123', 0);
    expect(debouncer.shouldAccept('123', 1600)).toBe(true);
  });

  it('tracks each barcode independently', () => {
    const debouncer = new ScanDebouncer(1500);
    debouncer.shouldAccept('123', 0);
    expect(debouncer.shouldAccept('456', 100)).toBe(true);
  });
});
