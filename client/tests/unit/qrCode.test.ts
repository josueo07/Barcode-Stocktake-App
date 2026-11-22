import { describe, expect, it } from 'vitest';
import { codeFromQrText } from '../../src/components/scanner/qrCode';

describe('codeFromQrText', () => {
  it('returns plain QR text trimmed', () => {
    expect(codeFromQrText('  012345678905 ')).toBe('012345678905');
    expect(codeFromQrText('https://example.com/p/1')).toBe('https://example.com/p/1');
  });

  it('extracts the GTIN from a GS1 QR code', () => {
    expect(codeFromQrText('(01)00312345678906(17)261231(10)A1')).toBe('00312345678906');
    expect(codeFromQrText(`]Q30100312345678906${String.fromCharCode(29)}10LOT1`)).toBe(
      '00312345678906',
    );
  });
});
