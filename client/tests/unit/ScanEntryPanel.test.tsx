import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScanEntryPanel } from '../../src/components/scanner/ScanEntryPanel';
import { parseCostToCents } from '../../src/lib/money';

describe('parseCostToCents', () => {
  it('reads common ways of typing a price', () => {
    expect(parseCostToCents('2.50')).toBe(250);
    expect(parseCostToCents('$2,5')).toBe(250);
    expect(parseCostToCents('3')).toBe(300);
    expect(parseCostToCents('')).toBeNull();
    expect(parseCostToCents('abc')).toBeUndefined();
    expect(parseCostToCents('1.234')).toBeUndefined();
  });
});

describe('ScanEntryPanel', () => {
  it('saves quantity only when cost is off and lot/expiry is unchecked', async () => {
    window.localStorage.clear();
    const onSave = vi.fn();
    render(
      <ScanEntryPanel barcode="123" costEnabled={false} onSave={onSave} onCancel={() => {}} />,
    );
    expect(screen.queryByLabelText(/costo/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^lote/i)).not.toBeInTheDocument();

    const qty = screen.getByLabelText('Cantidad');
    await userEvent.clear(qty);
    await userEvent.type(qty, '12');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledWith({
      quantity: 12,
      lot: undefined,
      expiryDate: undefined,
      unitCostCents: undefined,
      newProductName: undefined,
    });
  });

  it('asks for a name (and optional cost) when the product is not in the file', async () => {
    window.localStorage.clear();
    const onSave = vi.fn();
    render(
      <ScanEntryPanel
        barcode="7501234567890"
        productLookup="new"
        costEnabled={false}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/no está en el archivo/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/nombre/i);

    await userEvent.type(screen.getByLabelText('Nombre del producto'), 'Vitamina C 500mg');
    await userEvent.type(screen.getByLabelText(/costo unitario/i), '4.25');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 1,
        newProductName: 'Vitamina C 500mg',
        unitCostCents: 425,
      }),
    );
  });

  it('shows lot, expiry and cost fields when enabled', async () => {
    window.localStorage.clear();
    const onSave = vi.fn();
    render(<ScanEntryPanel barcode="123" costEnabled onSave={onSave} onCancel={() => {}} />);
    await userEvent.click(screen.getByLabelText(/anotar lote y expiración/i));
    await userEvent.type(screen.getByLabelText(/^lote/i), 'A77');
    await userEvent.type(screen.getByLabelText(/costo unitario/i), '4.25');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 1, lot: 'A77', unitCostCents: 425 }),
    );
  });

  it('refuses a zero quantity', async () => {
    const onSave = vi.fn();
    render(
      <ScanEntryPanel barcode="123" costEnabled={false} onSave={onSave} onCancel={() => {}} />,
    );
    const qty = screen.getByLabelText('Cantidad');
    await userEvent.clear(qty);
    await userEvent.type(qty, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/entero de 1 o más/);
  });
});
