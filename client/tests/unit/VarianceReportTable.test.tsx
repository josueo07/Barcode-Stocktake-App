import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { VarianceReport } from '@barcode-stocktake/shared';
import { VarianceReportTable } from '../../src/components/report/VarianceReportTable';

const report: VarianceReport = {
  sessionId: 1,
  generatedAt: new Date().toISOString(),
  rows: [
    {
      productId: 1,
      sku: 'SKU1',
      barcode: '111',
      name: 'Widget',
      expectedQty: 10,
      countedQty: 7,
      variance: -3,
    },
    {
      productId: 2,
      sku: 'SKU2',
      barcode: '222',
      name: 'Gadget',
      expectedQty: 4,
      countedQty: 4,
      variance: 0,
    },
  ],
  totals: { expectedQty: 14, countedQty: 11, variance: -3 },
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

  it('renders an empty state when there are no rows', () => {
    render(<VarianceReportTable report={{ ...report, rows: [] }} />);
    expect(screen.getByText(/no tiene esperados ni escaneos/i)).toBeInTheDocument();
  });
});
