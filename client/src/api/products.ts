import type { Product } from '@barcode-stocktake/shared';
import { ApiError, httpClient } from './httpClient';

export function searchProducts(search: string): Promise<Product[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return httpClient.get<{ products: Product[] }>(`/api/products${query}`).then((r) => r.products);
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  try {
    const res = await httpClient.get<{ product: Product }>(`/api/products/${encodeURIComponent(barcode)}`);
    return res.product;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}
