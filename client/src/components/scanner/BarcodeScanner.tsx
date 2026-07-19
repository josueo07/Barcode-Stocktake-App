import { useCallback, useEffect, useRef, useState } from 'react';
import Quagga, { type QuaggaJSCodeReader } from '@ericblade/quagga2';
import { ScanDebouncer } from './scanDebounce';

export interface BarcodeScannerProps {
  /** Called once per physical scan (debounced), with the decoded barcode string. */
  onDecode: (barcode: string) => void;
  /** Specific camera to use (from CameraDeviceSelect); omit to request the rear-facing camera. */
  deviceId?: string;
  active: boolean;
}

const READERS: QuaggaJSCodeReader[] = [
  'ean_reader',
  'ean_8_reader',
  'upc_reader',
  'upc_e_reader',
  'code_128_reader',
];

interface QuaggaDetectionResult {
  codeResult: { code: string | null };
}

export function BarcodeScanner({ onDecode, deviceId, active }: BarcodeScannerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const debouncerRef = useRef(new ScanDebouncer());
  const [error, setError] = useState<string | null>(null);

  const handleDetected = useCallback(
    (result: QuaggaDetectionResult) => {
      const code = result.codeResult.code;
      if (code && debouncerRef.current.shouldAccept(code)) {
        onDecode(code);
      }
    },
    [onDecode],
  );

  useEffect(() => {
    if (!active || !viewportRef.current) return undefined;

    const constraints: MediaTrackConstraints = deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: 'environment' };

    let cancelled = false;

    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: viewportRef.current,
          constraints,
        },
        decoder: { readers: READERS },
        locate: true,
      },
      (err: unknown) => {
        if (cancelled) return;
        if (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not start the camera. Check browser permissions and that no other app is using it.',
          );
          return;
        }
        setError(null);
        Quagga.start();
      },
    );

    Quagga.onDetected(handleDetected);

    return () => {
      cancelled = true;
      Quagga.offDetected(handleDetected);
      Quagga.stop();
    };
  }, [active, deviceId, handleDetected]);

  return (
    <div className="barcode-scanner">
      {error && (
        <p className="scanner-error" role="alert">
          {error}
        </p>
      )}
      <div ref={viewportRef} className="scanner-viewport" data-testid="scanner-viewport" />
    </div>
  );
}
