import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { VarianceReport } from '@barcode-stocktake/shared';
import { VarianceReportTable } from '../../src/components/report/VarianceReportTable';

const report: VarianceReport = {
  sessionId: 1,
  generatedAt: new Date().toISOString(),
  costEnabled: false,
  rows: [
    {
      productId: 1,
      sku: 'SKU1',
      barcode: '111',
      name: 'Widget',
      expectedQty: 10,
      countedQty: 7,
      variance: -3,
      unitCostCents: null,
      expectedValueCents: null,
      countedValueCents: null,
      valueVarianceCents: null,
    },
    {
      productId: 2,
      sku: 'SKU2',
      barcode: '222',
      name: 'Gadget',
      expectedQty: 4,
      countedQty: 4,
      variance: 0,
      unitCostCents: null,
      expectedValueCents: null,
      countedValueCents: null,
      valueVarianceCents: null,
    },
  ],
  totals: {
    expectedQty: 14,
    countedQty: 11,
    variance: -3,
    expectedValueCents: null,
    countedValueCents: null,
    valueVarianceCents: null,
  },
};

describe('VarianceReportTable', () => {
  it('renders each row', () => {
    render(<VarianceReportTable report={report} />);
    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(screen.getByText('Gadget')).toBeInTheDocument();
  });

  it('sums totals across rows correctly in the table footer', () => {
    const { container } = render(<VarianceReportTable report={report} />);
    const tfoot = container.querySelector('tfoot');
    expect(tfoot).not.toBeNull();
    const utils = within(tfoot as HTMLElement);
    expect(utils.getByText('14')).toBeInTheDocument();
    expect(utils.getByText('11')).toBeInTheDocument();
    expect(utils.getByText('-3')).toBeInTheDocument();
  });

  it('summarises discrepancies and can show only products with a difference', async () => {
    render(<VarianceReportTable report={report} />);
    expect(
      screen.getByText(/1 productos con diferencia: 1 con faltante, 0 con sobrante/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/solo productos con diferencia/i));
    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(screen.queryByText('Gadget')).not.toBeInTheDocument();
  });

  it('shows expected and counted value columns when costs are known', () => {
    render(
      <VarianceReportTable
        report={{
          ...report,
          costEnabled: true,
          rows: [
            {
              ...report.rows[0]!,
              unitCostCents: 250,
              expectedValueCents: 2500,
              countedValueCents: 1750,
              valueVarianceCents: -750,
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Valor esperado')).toBeInTheDocument();
    expect(screen.getAllByText(/7\.50/).length).toBeGreaterThan(0);
  });

  it('renders an empty state when there are no rows', () => {
    render(<VarianceReportTable report={{ ...report, rows: [] }} />);
    expect(screen.getByText(/no tiene esperados ni escaneos/i)).toBeInTheDocument();
  });
});
