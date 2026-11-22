import { useCallback, useEffect, useRef, useState } from 'react';
import Quagga, { type QuaggaJSCodeReader } from '@ericblade/quagga2';
import { readQrFromVideo } from './qrCode';
import { ScanDebouncer } from './scanDebounce';

export interface BarcodeScannerProps {
  /** Called once per physical scan (debounced), with the decoded barcode string. */
  onDecode: (barcode: string) => void;
  /** Specific camera to use (from CameraDeviceSelect); omit to request the rear-facing camera. */
  deviceId?: string;
  active: boolean;
}

/** How often (ms) a camera frame is checked for a QR code. Quagga only reads 1D barcodes. */
const QR_SCAN_INTERVAL_MS = 250;

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
    if (!active || !viewportRef.current) return undefined;

    const constraints: MediaTrackConstraints = deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: 'environment' };

    let cancelled = false;
    let qrTimer: ReturnType<typeof setInterval> | undefined;
    const viewport = viewportRef.current;

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
              : 'No se pudo abrir la cámara. Revisa que Safari tenga permiso de cámara y que ninguna otra app la esté usando.',
          );
          return;
        }
        setError(null);
        Quagga.start();
        const canvas = document.createElement('canvas');
        qrTimer = setInterval(() => {
          const video = viewport.querySelector('video');
          if (!video) return;
          try {
            acceptCode(readQrFromVideo(video, canvas));
          } catch {
            // A frame that can't be read is skipped; the next one is tried.
          }
        }, QR_SCAN_INTERVAL_MS);
      },
    );

    Quagga.onDetected(handleDetected);

    return () => {
      cancelled = true;
      if (qrTimer) clearInterval(qrTimer);
      Quagga.offDetected(handleDetected);
      Quagga.stop();
    };
  }, [active, deviceId, handleDetected, acceptCode]);

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
