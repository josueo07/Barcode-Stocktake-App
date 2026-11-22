import type { LiveCount } from '@barcode-stocktake/shared';

interface LiveCountTableProps {
  counts: LiveCount[];
  /** When provided, renders a "Remove" action for rows that have an expected quantity set. */
  onRemoveExpected?: (productId: number) => void;
}

export function LiveCountTable({ counts, onRemoveExpected }: LiveCountTableProps) {
  if (counts.length === 0) {
    return <p className="empty-state">Todavía no hay esperados ni escaneos en este conteo.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="live-count-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Código</th>
            <th>Producto</th>
            <th>Esperado</th>
            <th>Contado</th>
            {onRemoveExpected && <th />}
          </tr>
        </thead>
        <tbody>
          {counts.map((count) => (
            <tr
              key={count.barcode}
              className={count.expectedQty === null ? 'row-unexpected' : undefined}
            >
              <td>{count.sku ?? '—'}</td>
              <td>{count.barcode}</td>
              <td>{count.name ?? '(unmatched barcode)'}</td>
              <td>{count.expectedQty ?? '—'}</td>
              <td>{count.countedQty}</td>
              {onRemoveExpected && (
                <td>
                  {count.productId !== null && count.expectedQty !== null && (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => onRemoveExpected(count.productId as number)}
                    >
                      Quitar
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
