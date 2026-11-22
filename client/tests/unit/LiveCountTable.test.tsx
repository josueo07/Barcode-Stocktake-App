import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LiveCount } from '@barcode-stocktake/shared';
import { LiveCountTable } from '../../src/components/dashboard/LiveCountTable';

const counts: LiveCount[] = [
  { productId: 1, barcode: '111', sku: 'SKU1', name: 'Widget', expectedQty: 10, countedQty: 7 },
  { productId: null, barcode: '999', sku: null, name: null, expectedQty: null, countedQty: 2 },
];

describe('LiveCountTable', () => {
  it('renders an empty state when there are no rows', () => {
    render(<LiveCountTable counts={[]} />);
    expect(screen.getByText(/todavía no hay esperados ni escaneos/i)).toBeInTheDocument();
  });

  it('renders expected and unexpected-barcode rows', () => {
    render(<LiveCountTable counts={counts} />);
    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(screen.getByText('(unmatched barcode)')).toBeInTheDocument();
  });

  it('does not render a Remove action when onRemoveExpected is omitted', () => {
    render(<LiveCountTable counts={counts} />);
    expect(screen.queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument();
  });

  it('calls onRemoveExpected with the productId when Remove is clicked', async () => {
    const user = userEvent.setup();
    const onRemoveExpected = vi.fn();
    render(<LiveCountTable counts={counts} onRemoveExpected={onRemoveExpected} />);

    const removeButtons = screen.getAllByRole('button', { name: /quitar/i });
    expect(removeButtons).toHaveLength(1); // only the row with an expected quantity gets one
    await user.click(removeButtons[0]);

    expect(onRemoveExpected).toHaveBeenCalledWith(1);
  });
});
