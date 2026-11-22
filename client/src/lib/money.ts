/** "2.50" / "2,50" / "$2.5" → 250 cents. Returns null for blank, undefined for invalid. */
export function parseCostToCents(raw: string): number | null | undefined {
  const cleaned = raw.trim().replace(/[$\s]/g, '').replace(',', '.');
  if (cleaned === '') return null;
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return undefined;
  return Math.round(Number(cleaned) * 100);
}
