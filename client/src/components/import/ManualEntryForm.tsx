import { useState, type FormEvent } from 'react';
import { addManualExpectedQuantity } from '../../api/sessions';

export interface ManualEntryFormProps {
  sessionId: number;
  onAdded: () => void;
}

const initialFormState = { barcode: '', expectedQty: '', sku: '', name: '' };

export function ManualEntryForm({ sessionId, onAdded }: ManualEntryFormProps) {
  const [form, setForm] = useState(initialFormState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const expectedQty = Number(form.expectedQty);
    if (!form.barcode.trim() || !Number.isInteger(expectedQty) || expectedQty < 0) {
      setError('Barcode and a non-negative whole-number quantity are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await addManualExpectedQuantity(sessionId, {
        barcode: form.barcode.trim(),
        expectedQty,
        sku: form.sku.trim() || undefined,
        name: form.name.trim() || undefined,
      });
      setForm(initialFormState);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add expected quantity');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="manual-entry-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>
          Barcode
          <input
            value={form.barcode}
            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            required
          />
        </label>
        <label>
          Expected qty
          <input
            type="number"
            min={0}
            step={1}
            value={form.expectedQty}
            onChange={(e) => setForm({ ...form, expectedQty: e.target.value })}
            required
          />
        </label>
      </div>
      <p className="field-hint">
        If the barcode is new, also provide SKU and name to create the product:
      </p>
      <div className="form-row">
        <label>
          SKU (new products only)
          <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        </label>
        <label>
          Name (new products only)
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
      </div>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Adding…' : 'Add / update expected quantity'}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
