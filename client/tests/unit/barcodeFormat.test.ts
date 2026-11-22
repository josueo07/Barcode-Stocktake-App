import { describe, expect, it } from 'vitest';
import { printedBarcode } from '../../src/components/scanner/barcodeFormat';

describe('printedBarcode', () => {
  it('turns a UPC-A read as EAN-13 back into the 12 printed digits', () => {
    expect(printedBarcode('0801108110031')).toBe('801108110031');
  });

  it('leaves real EAN-13, EAN-8 and Code 128 codes alone', () => {
    expect(printedBarcode('7501031311309')).toBe('7501031311309');
    expect(printedBarcode('96385074')).toBe('96385074');
    expect(printedBarcode('ABC-123')).toBe('ABC-123');
  });
});
