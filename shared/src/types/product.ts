export interface Product {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  sku: string;
  barcode: string;
  name: string;
  category?: string | null;
}
