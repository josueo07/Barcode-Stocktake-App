import type { RequestHandler } from 'express';
import { eq, like } from 'drizzle-orm';
import type { AppDatabase } from '../db/client';
import { products, scanEvents, sessionExpectedQuantities } from '../db/schema';
import { AppError } from '../middleware/errorHandler';

function getProductOrThrow(db: AppDatabase, id: number) {
  const product = db.select().from(products).where(eq(products.id, id)).get();
  if (!product) {
    throw new AppError(`Product ${id} not found`, 404);
  }
  return product;
}

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

export function updateProduct(db: AppDatabase): RequestHandler {
  return (req, res, next) => {
    try {
      const id = Number(req.params.id);
      getProductOrThrow(db, id);

      const { sku, barcode, name, category } = req.body as {
        sku?: string;
        barcode?: string;
        name?: string;
        category?: string | null;
      };

      if (sku !== undefined) {
        const clash = db.select().from(products).where(eq(products.sku, sku)).get();
        if (clash && clash.id !== id) {
          next(new AppError(`A product with sku "${sku}" already exists`, 409));
          return;
        }
      }
      if (barcode !== undefined) {
        const clash = db.select().from(products).where(eq(products.barcode, barcode)).get();
        if (clash && clash.id !== id) {
          next(new AppError(`A product with barcode "${barcode}" already exists`, 409));
          return;
        }
      }

      const updates: Partial<typeof products.$inferInsert> = { updatedAt: new Date().toISOString() };
      if (sku !== undefined) updates.sku = sku;
      if (barcode !== undefined) updates.barcode = barcode;
      if (name !== undefined) updates.name = name;
      if (category !== undefined) updates.category = category;

      const product = db.update(products).set(updates).where(eq(products.id, id)).returning().get();
      res.json({ product });
    } catch (err) {
      next(err);
    }
  };
}

export function deleteProduct(db: AppDatabase): RequestHandler {
  return (req, res, next) => {
    try {
      const id = Number(req.params.id);
      getProductOrThrow(db, id);

      const expectedQtyCount = db
        .select()
        .from(sessionExpectedQuantities)
        .where(eq(sessionExpectedQuantities.productId, id))
        .all().length;
      const scanCount = db.select().from(scanEvents).where(eq(scanEvents.productId, id)).all().length;

      if (expectedQtyCount > 0 || scanCount > 0) {
        next(
          new AppError(
            `Cannot delete product ${id}: it is referenced by ${expectedQtyCount} expected-quantity row(s) and ${scanCount} scan(s). Remove those references first.`,
            409,
          ),
        );
        return;
      }

      db.delete(products).where(eq(products.id, id)).run();
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
