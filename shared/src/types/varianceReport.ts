export interface VarianceReportRow {
  productId: number | null;
  sku: string | null;
  barcode: string;
  name: string | null;
  expectedQty: number;
  countedQty: number;
  variance: number;
}

export interface VarianceReportTotals {
  expectedQty: number;
  countedQty: number;
  variance: number;
}

export interface VarianceReport {
  sessionId: number;
  generatedAt: string;
  rows: VarianceReportRow[];
  totals: VarianceReportTotals;
}
