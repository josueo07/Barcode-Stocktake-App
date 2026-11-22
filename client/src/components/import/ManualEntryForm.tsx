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
      setError('Escribe el código y una cantidad entera de 0 o más.');
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
      setError(err instanceof Error ? err.message : 'No se pudo guardar el esperado');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="manual-entry-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>
          Código
          <input
            value={form.barcode}
            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            required
          />
        </label>
        <label>
          Cantidad esperada
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
        Si el código es nuevo, añade SKU y nombre para crear el producto:
      </p>
      <div className="form-row">
        <label>
          SKU (solo productos nuevos)
          <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        </label>
        <label>
          Nombre (solo productos nuevos)
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
      </div>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando…' : 'Guardar esperado'}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
