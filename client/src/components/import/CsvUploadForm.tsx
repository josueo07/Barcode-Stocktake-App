import { useState, type FormEvent } from 'react';
import type { CsvImportSummary } from '@barcode-stocktake/shared';
import { importSessionCsv } from '../../api/sessions';

export interface CsvUploadFormProps {
  sessionId: number;
  onImported: (summary: CsvImportSummary) => void;
}

export function CsvUploadForm({ sessionId, onImported }: CsvUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<CsvImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantityColumn, setQuantityColumn] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await importSessionCsv(
        sessionId,
        file,
        quantityColumn === '' ? undefined : Number(quantityColumn),
      );
      setSummary(result);
      if (result.expectedQuantitiesWritten > 0) onImported(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo importar el archivo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="csv-upload-form" onSubmit={handleSubmit}>
      <label>
        Archivo de inventario de la farmacia (Excel o CSV)
        <input
          type="file"
          accept=".xlsx,.csv,.tsv,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setSummary(null);
            setError(null);
            setQuantityColumn('');
          }}
        />
      </label>
      <p className="field-hint">
        Columnas: UPC (o Código), Nombre, Cantidad y Costo. SKU y Categoría son opcionales. Si la
        farmacia no tiene inventario, no subas nada: se cuenta igual.
      </p>
      {summary?.quantityHeaders && (
        <label>
          ¿Qué columna contiene la cantidad esperada?
          <select value={quantityColumn} onChange={(e) => setQuantityColumn(e.target.value)}>
            <option value="">Selecciona una columna</option>
            {summary.quantityHeaders.map((header, index) => (
              <option key={index} value={index} disabled={!header.trim()}>
                {header}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="submit"
        disabled={!file || isSubmitting || Boolean(summary?.quantityHeaders && !quantityColumn)}
      >
        {isSubmitting ? 'Importando…' : 'Importar archivo'}
      </button>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {summary && !summary.quantityHeaders && (
        <div className="import-summary" role="status">
          {summary.expectedQuantitiesWritten === 0 && <p>No se guardaron cantidades esperadas.</p>}
          <p>
            Productos nuevos: {summary.productsCreated}, actualizados: {summary.productsUpdated}.
            Esperados guardados: {summary.expectedQuantitiesWritten}. Filas omitidas:{' '}
            {summary.rowsSkipped}.
          </p>
          {summary.errors.length > 0 && (
            <ul className="import-errors">
              {summary.errors.map((rowError, index) => (
                <li key={index}>
                  Fila {rowError.row}: {rowError.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
