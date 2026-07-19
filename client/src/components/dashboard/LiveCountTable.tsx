import type { LiveCount } from '@barcode-stocktake/shared';

export function LiveCountTable({ counts }: { counts: LiveCount[] }) {
  if (counts.length === 0) {
    return <p className="empty-state">No expected quantities or scans yet for this session.</p>;
  }

  return (
    <table className="live-count-table">
      <thead>
        <tr>
          <th>SKU</th>
          <th>Barcode</th>
          <th>Name</th>
          <th>Expected</th>
          <th>Counted</th>
        </tr>
      </thead>
      <tbody>
        {counts.map((count) => (
          <tr key={count.barcode} className={count.expectedQty === null ? 'row-unexpected' : undefined}>
            <td>{count.sku ?? '—'}</td>
            <td>{count.barcode}</td>
            <td>{count.name ?? '(unmatched barcode)'}</td>
            <td>{count.expectedQty ?? '—'}</td>
            <td>{count.countedQty}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
