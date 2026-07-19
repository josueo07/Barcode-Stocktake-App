import { Router } from 'express';
import { z } from 'zod';
import type { AppDatabase } from '../db/client';
import { validateBody } from '../middleware/validateRequest';
import {
  createProduct,
  deleteProduct,
  getProductByBarcode,
  listProducts,
  updateProduct,
} from '../controllers/products.controller';

const createProductSchema = z.object({
  sku: z.string().min(1),
  barcode: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1).nullable().optional(),
});

const updateProductSchema = z.object({
  sku: z.string().min(1).optional(),
  barcode: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  category: z.string().min(1).nullable().optional(),
});

export function createProductsRouter(db: AppDatabase): Router {
  const router = Router();

  router.get('/', listProducts(db));
  router.post('/', validateBody(createProductSchema), createProduct(db));
  router.patch('/:id', validateBody(updateProductSchema), updateProduct(db));
  router.delete('/:id', deleteProduct(db));
  router.get('/:barcode', getProductByBarcode(db));

  return router;
}
