import { useState } from 'react';
import type { VarianceReport } from '@barcode-stocktake/shared';

const money = new Intl.NumberFormat('es-PR', { style: 'currency', currency: 'USD' });
const formatCents = (cents: number | null) => (cents === null ? '—' : money.format(cents / 100));
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function varianceClass(variance: number | null): string {
  if (variance === null || variance === 0) return 'variance-zero';
  return variance < 0 ? 'variance-negative' : 'variance-positive';
}

export function VarianceReportTable({ report }: { report: VarianceReport }) {
  const [onlyDifferences, setOnlyDifferences] = useState(false);

  if (report.rows.length === 0) {
    return <p className="empty-state">Este conteo no tiene esperados ni escaneos.</p>;
  }

  const withDifference = report.rows.filter((row) => row.variance !== 0);
  const missing = withDifference.filter((row) => row.variance < 0).length;
  const extra = withDifference.length - missing;
  const rows = onlyDifferences ? withDifference : report.rows;

  return (
    <>
      <p className="variance-summary">
        {withDifference.length === 0
          ? 'Todo cuadra: no hay diferencias.'
          : `${withDifference.length} productos con diferencia: ${missing} con faltante, ${extra} con sobrante.`}
        {report.costEnabled && report.totals.valueVarianceCents !== null && (
          <> Diferencia en valor: {formatCents(report.totals.valueVarianceCents)}.</>
        )}
      </p>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={onlyDifferences}
          onChange={(e) => setOnlyDifferences(e.target.checked)}
        />
        Ver solo productos con diferencia
      </label>

      <div className="table-scroll">
        <table className="variance-report-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Esperado</th>
              <th>Contado</th>
              <th>Diferencia</th>
              {report.costEnabled && (
                <>
                  <th>Costo</th>
                  <th>Valor esperado</th>
                  <th>Valor contado</th>
                  <th>Diferencia en valor</th>
                </>
              )}
              <th>Código</th>
              <th>SKU</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.productId ?? `b${row.barcode}`}>
                <td>{row.name ?? '(código sin producto)'}</td>
                <td>{row.expectedQty}</td>
                <td>{row.countedQty}</td>
                <td className={varianceClass(row.variance)}>{signed(row.variance)}</td>
                {report.costEnabled && (
                  <>
                    <td>{formatCents(row.unitCostCents)}</td>
                    <td>{formatCents(row.expectedValueCents)}</td>
                    <td>{formatCents(row.countedValueCents)}</td>
                    <td className={varianceClass(row.valueVarianceCents)}>
                      {formatCents(row.valueVarianceCents)}
                    </td>
                  </>
                )}
                <td>{row.barcode}</td>
                <td>{row.sku ?? '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>Totales</th>
              <th>{report.totals.expectedQty}</th>
              <th>{report.totals.countedQty}</th>
              <th className={varianceClass(report.totals.variance)}>
                {signed(report.totals.variance)}
              </th>
              {report.costEnabled && (
                <>
                  <th />
                  <th>{formatCents(report.totals.expectedValueCents)}</th>
                  <th>{formatCents(report.totals.countedValueCents)}</th>
                  <th className={varianceClass(report.totals.valueVarianceCents)}>
                    {formatCents(report.totals.valueVarianceCents)}
                  </th>
                </>
              )}
              <th colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
