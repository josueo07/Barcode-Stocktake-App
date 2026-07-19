import type { VarianceReport } from '@barcode-stocktake/shared';

function varianceClass(variance: number): string {
  if (variance < 0) return 'variance-negative';
  if (variance > 0) return 'variance-positive';
  return 'variance-zero';
}

export function VarianceReportTable({ report }: { report: VarianceReport }) {
  if (report.rows.length === 0) {
    return <p className="empty-state">No expected quantities or scans recorded for this session.</p>;
  }

  return (
    <table className="variance-report-table">
      <thead>
        <tr>
          <th>SKU</th>
          <th>Barcode</th>
          <th>Name</th>
          <th>Expected</th>
          <th>Counted</th>
          <th>Variance</th>
        </tr>
      </thead>
      <tbody>
        {report.rows.map((row) => (
          <tr key={row.barcode}>
            <td>{row.sku ?? '—'}</td>
            <td>{row.barcode}</td>
            <td>{row.name ?? '(unmatched barcode)'}</td>
            <td>{row.expectedQty}</td>
            <td>{row.countedQty}</td>
            <td className={varianceClass(row.variance)}>{row.variance > 0 ? `+${row.variance}` : row.variance}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th colSpan={3}>Totals</th>
          <th>{report.totals.expectedQty}</th>
          <th>{report.totals.countedQty}</th>
          <th className={varianceClass(report.totals.variance)}>
            {report.totals.variance > 0 ? `+${report.totals.variance}` : report.totals.variance}
          </th>
        </tr>
      </tfoot>
    </table>
  );
}
