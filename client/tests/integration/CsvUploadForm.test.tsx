import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { CsvUploadForm } from '../../src/components/import/CsvUploadForm';
import { config } from '../../src/config';
import { server } from '../mocks/server';

describe('CsvUploadForm', () => {
  it('submits the selected file and shows the import summary', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/api/sessions/1/import-csv`, () =>
        HttpResponse.json({
          summary: {
            productsCreated: 2,
            productsUpdated: 0,
            expectedQuantitiesWritten: 2,
            rowsSkipped: 0,
            errors: [],
          },
        }),
      ),
    );

    const user = userEvent.setup();
    const onImported = vi.fn();
    render(<CsvUploadForm sessionId={1} onImported={onImported} />);

    const file = new File(['sku,barcode,name,expected_qty\nSKU1,111,Widget,5\n'], 'products.csv', {
      type: 'text/csv',
    });
    await user.upload(screen.getByLabelText(/archivo csv de esperados/i), file);
    await user.click(screen.getByRole('button', { name: /importar csv/i }));

    await waitFor(() => expect(screen.getByText(/productos nuevos: 2, actualizados: 0/i)).toBeInTheDocument());
    expect(onImported).toHaveBeenCalled();
  });

  it('shows a form error when the import request fails', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/api/sessions/1/import-csv`, () =>
        HttpResponse.json({ error: { message: 'Session 1 not found' } }, { status: 404 }),
      ),
    );

    const user = userEvent.setup();
    render(<CsvUploadForm sessionId={1} onImported={vi.fn()} />);

    const file = new File(['sku,barcode,name,expected_qty\nSKU1,111,Widget,5\n'], 'products.csv', {
      type: 'text/csv',
    });
    await user.upload(screen.getByLabelText(/archivo csv de esperados/i), file);
    await user.click(screen.getByRole('button', { name: /importar csv/i }));

    await waitFor(() => expect(screen.getByText(/session 1 not found/i)).toBeInTheDocument());
  });
});
