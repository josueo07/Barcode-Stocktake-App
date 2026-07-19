import type { RequestHandler } from 'express';
import { eq, like } from 'drizzle-orm';
import type { AppDatabase } from '../db/client';
import { products } from '../db/schema';
import { AppError } from '../middleware/errorHandler';

export function listProducts(db: AppDatabase): RequestHandler {
  return (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const rows = search
      ? db.select().from(products).where(like(products.name, `%${search}%`)).all()
      : db.select().from(products).all();
    res.json({ products: rows });
  };
}

export function getProductByBarcode(db: AppDatabase): RequestHandler {
  return (req, res, next) => {
    const product = db
      .select()
      .from(products)
      .where(eq(products.barcode, req.params.barcode))
      .get();
    if (!product) {
      next(new AppError(`No product found for barcode "${req.params.barcode}"`, 404));
      return;
    }
    res.json({ product });
  };
}

export function createProduct(db: AppDatabase): RequestHandler {
  return (req, res, next) => {
    const { sku, barcode, name, category } = req.body as {
      sku: string;
      barcode: string;
      name: string;
      category?: string | null;
    };

    const existing = db.select().from(products).where(eq(products.barcode, barcode)).get();
    if (existing) {
      next(new AppError(`A product with barcode "${barcode}" already exists`, 409));
      return;
    }

    const product = db
      .insert(products)
      .values({ sku, barcode, name, category: category ?? null })
      .returning()
      .get();
    res.status(201).json({ product });
  };
}
