import { useCallback, useEffect, useRef, useState } from 'react';
import Quagga, { type QuaggaJSCodeReader } from '@ericblade/quagga2';
import { ScanDebouncer } from './scanDebounce';

export interface BarcodeScannerProps {
  /** Called once per physical scan (debounced), with the decoded barcode string. */
  onDecode: (barcode: string) => void;
  /** Specific camera to use (from CameraDeviceSelect); omit to request the rear-facing camera. */
  deviceId?: string;
  active: boolean;
  restartCount?: number;
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

export function BarcodeScanner({
  onDecode,
  deviceId,
  active,
  restartCount = 0,
}: BarcodeScannerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const cameraStoppedRef = useRef<Promise<void> | null>(null);
  const debouncerRef = useRef(new ScanDebouncer());
  const [error, setError] = useState<string | null>(null);

  const acceptCode = useCallback(
    (code: string | null) => {
      if (code && debouncerRef.current.shouldAccept(code)) {
        onDecode(code);
      }
    },
    [onDecode],
  );

  const handleDetected = useCallback(
    (result: QuaggaDetectionResult) => acceptCode(result.codeResult.code),
    [acceptCode],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!active || !viewport) return undefined;

    const constraints: MediaTrackConstraints = deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: 'environment' };

    let cancelled = false;
    let opened = false;

    const openCamera = () => {
      if (cancelled) return;
      opened = true;
      Quagga.init(
        {
          inputStream: {
            type: 'LiveStream',
            target: viewport,
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
                : 'No se pudo abrir la cámara. Revisa que Safari tenga permiso de cámara y que ninguna otra app la esté usando.',
            );
            return;
          }
          setError(null);
          Quagga.start();
        },
      );

      Quagga.onDetected(handleDetected);
    };

    if (cameraStoppedRef.current) void cameraStoppedRef.current.then(openCamera);
    else openCamera();

    return () => {
      cancelled = true;
      if (!opened) return;
      Quagga.offDetected(handleDetected);
      cameraStoppedRef.current = Promise.resolve(Quagga.stop()).catch(() => undefined);
    };
  }, [active, deviceId, handleDetected, acceptCode, restartCount]);

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
