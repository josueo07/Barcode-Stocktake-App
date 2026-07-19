import type { CreateProductInput, Product, UpdateProductInput } from '@barcode-stocktake/shared';
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

export function createProduct(input: CreateProductInput): Promise<Product> {
  return httpClient.post<{ product: Product }>('/api/products', input).then((r) => r.product);
}

export function updateProduct(id: number, input: UpdateProductInput): Promise<Product> {
  return httpClient.patch<{ product: Product }>(`/api/products/${id}`, input).then((r) => r.product);
}

export function deleteProduct(id: number): Promise<void> {
  return httpClient.delete(`/api/products/${id}`);
}
