export interface VarianceReportRow {
  productId: number | null;
  sku: string | null;
  barcode: string;
  name: string | null;
  expectedQty: number;
  countedQty: number;
  variance: number;
  /** Unit cost from the imported file (cents). */
  unitCostCents: number | null;
  /** expectedQty × imported unit cost (cents). Null when there is no imported cost. */
  expectedValueCents: number | null;
  /**
   * Counted quantity valued at the cost typed at scan time, or the imported cost when none
   * was typed (cents). Null when no cost is known.
   */
  countedValueCents: number | null;
  /** countedValueCents − expectedValueCents (cents). */
  valueVarianceCents: number | null;
}

export interface VarianceReportTotals {
  expectedQty: number;
  countedQty: number;
  variance: number;
  expectedValueCents: number | null;
  countedValueCents: number | null;
  valueVarianceCents: number | null;
}

export interface VarianceReport {
  sessionId: number;
  generatedAt: string;
  /** True when any cost is known (cost typed at scan time or imported); shows value columns. */
  costEnabled: boolean;
  rows: VarianceReportRow[];
  totals: VarianceReportTotals;
}
