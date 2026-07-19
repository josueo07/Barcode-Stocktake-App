import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BarcodeScanner } from '../../src/components/scanner/BarcodeScanner';

const { mockInit, mockStart, mockStop, mockOnDetected, mockOffDetected, detectedHandlers } = vi.hoisted(
  () => {
    const handlers: Array<(result: unknown) => void> = [];
    return {
      detectedHandlers: handlers,
      mockInit: vi.fn((_config: unknown, cb: (err: unknown) => void) => cb(null)),
      mockStart: vi.fn(),
      mockStop: vi.fn(),
      mockOnDetected: vi.fn((handler: (result: unknown) => void) => handlers.push(handler)),
      mockOffDetected: vi.fn(),
    };
  },
);

vi.mock('@ericblade/quagga2', () => ({
  default: {
    init: mockInit,
    start: mockStart,
    stop: mockStop,
    onDetected: mockOnDetected,
    offDetected: mockOffDetected,
  },
}));

describe('BarcodeScanner', () => {
  beforeEach(() => {
    detectedHandlers.length = 0;
    mockInit.mockClear();
    mockStart.mockClear();
  });

  it('starts Quagga and forwards a decoded barcode to onDecode', async () => {
    const onDecode = vi.fn();
    render(<BarcodeScanner active onDecode={onDecode} />);

    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    detectedHandlers[0]?.({ codeResult: { code: '1234567890123' } });

    expect(onDecode).toHaveBeenCalledWith('1234567890123');
  });

  it('debounces repeat detections of the same barcode', async () => {
    const onDecode = vi.fn();
    render(<BarcodeScanner active onDecode={onDecode} />);
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    detectedHandlers[0]?.({ codeResult: { code: '1234567890123' } });
    detectedHandlers[0]?.({ codeResult: { code: '1234567890123' } });

    expect(onDecode).toHaveBeenCalledTimes(1);
  });

  it('does not initialize the camera when inactive', () => {
    render(<BarcodeScanner active={false} onDecode={vi.fn()} />);
    expect(mockInit).not.toHaveBeenCalled();
  });
});
