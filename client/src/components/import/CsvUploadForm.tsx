import { useState, type FormEvent } from 'react';
import type { CsvImportSummary } from '@barcode-stocktake/shared';
import { importSessionCsv } from '../../api/sessions';

export interface CsvUploadFormProps {
  sessionId: number;
  onImported: () => void;
}

export function CsvUploadForm({ sessionId, onImported }: CsvUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<CsvImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await importSessionCsv(sessionId, file);
      setSummary(result);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="csv-upload-form" onSubmit={handleSubmit}>
      <label>
        Expected quantities CSV
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <p className="field-hint">Columns required: sku, barcode, name, expected_qty (category optional)</p>
      <button type="submit" disabled={!file || isSubmitting}>
        {isSubmitting ? 'Importing…' : 'Import CSV'}
      </button>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {summary && (
        <div className="import-summary">
          <p>
            Created {summary.productsCreated}, updated {summary.productsUpdated} products —{' '}
            {summary.expectedQuantitiesWritten} expected quantities written, {summary.rowsSkipped} rows
            skipped.
          </p>
          {summary.errors.length > 0 && (
            <ul className="import-errors">
              {summary.errors.map((rowError) => (
                <li key={rowError.row}>
                  Row {rowError.row}: {rowError.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
