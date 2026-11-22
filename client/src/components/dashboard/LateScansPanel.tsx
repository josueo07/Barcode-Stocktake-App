import { useCallback, useEffect, useState } from 'react';
import type { ScanEvent } from '@barcode-stocktake/shared';
import { acceptLateScans, listLateScans } from '../../api/scans';
import { ErrorBanner } from '../common/ErrorBanner';

interface LateScansPanelProps {
  sessionId: number;
  onAccepted: () => void;
}

/**
 * Scans that reached the server after the count was closed (usually a phone that was offline).
 * They are not in the totals until the supervisor accepts them.
 */
export function LateScansPanel({ sessionId, onAccepted }: LateScansPanelProps) {
  const [scans, setScans] = useState<ScanEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setScans(await listLateScans(sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los escaneos tardíos');
    }
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const accept = async (ids: number[]) => {
    setIsSaving(true);
    try {
      await acceptLateScans(sessionId, ids);
      await refresh();
      onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron aceptar');
    } finally {
      setIsSaving(false);
    }
  };

  if (scans.length === 0 && !error) return null;

  return (
    <section className="late-scans">
      <h2>Escaneos después del cierre ({scans.length})</h2>
      <p>
        Llegaron al servidor después de cerrar el conteo y no están en los totales. Acéptalos si se
        hicieron antes del cierre (por ejemplo, un teléfono que estaba sin Wi‑Fi).
      </p>
      {error && <ErrorBanner message={error} />}
      {scans.length > 0 && (
        <>
          <button type="button" disabled={isSaving} onClick={() => accept(scans.map((s) => s.id))}>
            Aceptar todos
          </button>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Cant.</th>
                <th>Escaneado</th>
                <th>Equipo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {scans.map((s) => (
                <tr key={s.id}>
                  <td>{s.barcode}</td>
                  <td>{s.quantity}</td>
                  <td>{new Date(s.scannedAt).toLocaleString('es-PR')}</td>
                  <td>{s.deviceLabel ?? ''}</td>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      disabled={isSaving}
                      onClick={() => accept([s.id])}
                    >
                      Aceptar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
