import { useEffect, useRef, useState, type FormEvent } from 'react';
import { parseCostToCents } from '../../lib/money';

const TRACK_LOT_KEY = 'stocktake.trackLotExpiry';

function readTrackLot(): boolean {
  try {
    return window.localStorage.getItem(TRACK_LOT_KEY) === '1';
  } catch {
    return false;
  }
}

function writeTrackLot(value: boolean) {
  try {
    window.localStorage.setItem(TRACK_LOT_KEY, value ? '1' : '0');
  } catch {
    // ignore
  }
}

export interface ScanEntryDetails {
  quantity: number;
  lot?: string;
  expiryDate?: string;
  unitCostCents?: number;
  newProductName?: string;
}

/**
 * loading: looking the code up. found: in the catalog. new: the server says it isn't, so a name
 * is needed to create it. unknown: no connection, so the name is optional.
 */
export type ProductLookup = 'loading' | 'found' | 'new' | 'unknown';

interface ScanEntryPanelProps {
  barcode: string;
  productName?: string | null;
  productLookup?: ProductLookup;
  costEnabled: boolean;
  onSave: (details: ScanEntryDetails) => void;
  onCancel: () => void;
}

/**
 * Shown after each scan: confirm the quantity, and optionally lot, expiry and unit cost,
 * before the scan is saved to the phone's queue.
 */
export function ScanEntryPanel({
  barcode,
  productName,
  productLookup = 'found',
  costEnabled,
  onSave,
  onCancel,
}: ScanEntryPanelProps) {
  const [quantity, setQuantity] = useState('1');
  const [trackLot, setTrackLot] = useState(readTrackLot);
  const [lot, setLot] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cost, setCost] = useState('');
  const [newName, setNewName] = useState('');
  const isNew = productLookup === 'new';
  const mayBeNew = isNew || productLookup === 'unknown';
  const showCost = costEnabled || isNew;
  const [error, setError] = useState<string | null>(null);
  const quantityRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    quantityRef.current?.focus();
    quantityRef.current?.select();
  }, [barcode]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 100000) {
      setError('La cantidad tiene que ser un número entero de 1 o más.');
      return;
    }
    if (isNew && !newName.trim()) {
      setError('Escribe el nombre del producto para crearlo.');
      return;
    }
    let unitCostCents: number | undefined;
    if (showCost) {
      const parsed = parseCostToCents(cost);
      if (parsed === undefined) {
        setError('Escribe el costo como 2.50');
        return;
      }
      unitCostCents = parsed ?? undefined;
    }
    onSave({
      quantity: qty,
      lot: trackLot && lot.trim() ? lot.trim() : undefined,
      expiryDate: trackLot && expiry ? expiry : undefined,
      unitCostCents,
      newProductName: mayBeNew && newName.trim() ? newName.trim() : undefined,
    });
  };

  return (
    <form className="scan-entry-panel" onSubmit={handleSubmit}>
      <p className="scan-entry-barcode">
        <strong>{barcode}</strong>
        {productName && <span> · {productName}</span>}
        {productLookup === 'loading' && <span className="field-hint"> · buscando…</span>}
      </p>
      {mayBeNew && (
        <div className="new-product-box">
          <p className="field-hint">
            {isNew
              ? 'Este producto no está en el archivo. Escribe el nombre para crearlo.'
              : 'Sin conexión: si este producto no está en el archivo, escribe el nombre (opcional).'}
          </p>
          <label>
            Nombre del producto{isNew ? '' : ' (opcional)'}
            <input value={newName} onChange={(e) => setNewName(e.target.value)} />
          </label>
        </div>
      )}
      <label>
        Cantidad
        <input
          ref={quantityRef}
          inputMode="numeric"
          pattern="[0-9]*"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </label>
      {showCost && (
        <label>
          Costo unitario ($){costEnabled ? '' : ' (opcional)'}
          <input
            inputMode="decimal"
            placeholder="0.00"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </label>
      )}
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={trackLot}
          onChange={(e) => {
            setTrackLot(e.target.checked);
            writeTrackLot(e.target.checked);
          }}
        />
        Anotar lote y expiración
      </label>
      {trackLot && (
        <>
          <label>
            Lote
            <input
              value={lot}
              autoCapitalize="characters"
              onChange={(e) => setLot(e.target.value)}
            />
          </label>
          <label>
            Expiración (mes y año)
            <input type="month" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </label>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="scan-entry-actions">
        <button type="submit">Guardar</button>
        <button type="button" className="button-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
