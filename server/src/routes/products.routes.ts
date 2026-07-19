import { Router } from 'express';
import { z } from 'zod';
import type { AppDatabase } from '../db/client';
import { validateBody } from '../middleware/validateRequest';
import { createProduct, getProductByBarcode, listProducts } from '../controllers/products.controller';

const createProductSchema = z.object({
  sku: z.string().min(1),
  barcode: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1).nullable().optional(),
});

export function createProductsRouter(db: AppDatabase): Router {
  const router = Router();

  router.get('/', listProducts(db));
  router.get('/:barcode', getProductByBarcode(db));
  router.post('/', validateBody(createProductSchema), createProduct(db));

  return router;
}
