import type { RequestHandler } from 'express';
import { and, eq } from 'drizzle-orm';
import type { Server as SocketIOServer } from 'socket.io';
import { SOCKET_EVENTS, type SessionStatus } from '@barcode-stocktake/shared';
import type { AppDatabase } from '../db/client';
import { products, sessionExpectedQuantities, stocktakeSessions } from '../db/schema';
import { AppError } from '../middleware/errorHandler';
import { importCsv } from '../services/csvImport.service';
import { persistVarianceReportSnapshot } from '../services/varianceReport.service';

function getSessionOrThrow(db: AppDatabase, id: number) {
  const session = db.select().from(stocktakeSessions).where(eq(stocktakeSessions.id, id)).get();
  if (!session) {
    throw new AppError(`Session ${id} not found`, 404);
  }
  return session;
}

export function listSessions(db: AppDatabase): RequestHandler {
  return (_req, res) => {
    res.json({ sessions: db.select().from(stocktakeSessions).all() });
  };
}

export function getSession(db: AppDatabase): RequestHandler {
  return (req, res, next) => {
    try {
      res.json({ session: getSessionOrThrow(db, Number(req.params.id)) });
    } catch (err) {
      next(err);
    }
  };
}

export function createSession(db: AppDatabase): RequestHandler {
  return (req, res) => {
    const { name, notes } = req.body as { name: string; notes?: string | null };
    const session = db
      .insert(stocktakeSessions)
      .values({ name, notes: notes ?? null, status: 'draft' })
      .returning()
      .get();
    res.status(201).json({ session });
  };
}

export function updateSession(db: AppDatabase, io?: SocketIOServer): RequestHandler {
  return (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const existing = getSessionOrThrow(db, id);

      const { name, notes, status } = req.body as {
        name?: string;
        notes?: string | null;
        status?: SessionStatus;
      };

      const updates: Partial<typeof stocktakeSessions.$inferInsert> = {};
      if (name !== undefined) updates.name = name;
      if (notes !== undefined) updates.notes = notes;
      if (status !== undefined) {
        updates.status = status;
        if (status === 'active' && !existing.startedAt) {
          updates.startedAt = new Date().toISOString();
        }
        if (status === 'completed') {
          updates.completedAt = new Date().toISOString();
        }
      }

      const session = db
        .update(stocktakeSessions)
        .set(updates)
        .where(eq(stocktakeSessions.id, id))
        .returning()
        .get();

      if (status === 'completed') {
        persistVarianceReportSnapshot(db, id);
      }

      if (status !== undefined) {
        io?.to(`session:${id}`).emit(SOCKET_EVENTS.STATUS_CHANGED, { sessionId: id, status: session.status });
      }

      res.json({ session });
    } catch (err) {
      next(err);
    }
  };
}

export function deleteSession(db: AppDatabase): RequestHandler {
  return (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const existing = getSessionOrThrow(db, id);

      if (existing.status !== 'draft') {
        next(
          new AppError(
            `Cannot delete session ${id}: only sessions in "draft" status can be deleted (this one is "${existing.status}"). Stocktake history is preserved once a session starts.`,
            409,
          ),
        );
        return;
      }

      db.delete(stocktakeSessions).where(eq(stocktakeSessions.id, id)).run();
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

export function importSessionCsv(db: AppDatabase, io?: SocketIOServer): RequestHandler {
  return (req, res, next) => {
    try {
      const id = Number(req.params.id);
      getSessionOrThrow(db, id);

      if (!req.file) {
        next(new AppError('CSV file is required (multipart field "file")', 400));
        return;
      }

      const summary = importCsv(db, id, req.file.buffer);
      io?.to(`session:${id}`).emit(SOCKET_EVENTS.EXPECTED_QTY_UPDATED, { sessionId: id });
      res.json({ summary });
    } catch (err) {
      next(err);
    }
  };
}

export function listExpectedQuantities(db: AppDatabase): RequestHandler {
  return (req, res, next) => {
    try {
      const id = Number(req.params.id);
      getSessionOrThrow(db, id);

      const rows = db
        .select({
          id: sessionExpectedQuantities.id,
          sessionId: sessionExpectedQuantities.sessionId,
          productId: sessionExpectedQuantities.productId,
          expectedQty: sessionExpectedQuantities.expectedQty,
          source: sessionExpectedQuantities.source,
          createdAt: sessionExpectedQuantities.createdAt,
          updatedAt: sessionExpectedQuantities.updatedAt,
          sku: products.sku,
          barcode: products.barcode,
          name: products.name,
        })
        .from(sessionExpectedQuantities)
        .innerJoin(products, eq(sessionExpectedQuantities.productId, products.id))
        .where(eq(sessionExpectedQuantities.sessionId, id))
        .all();

      res.json({ expectedQuantities: rows });
    } catch (err) {
      next(err);
    }
  };
}

export function addManualExpectedQuantity(db: AppDatabase, io?: SocketIOServer): RequestHandler {
  return (req, res, next) => {
    try {
      const id = Number(req.params.id);
      getSessionOrThrow(db, id);

      const { barcode, expectedQty, name, sku } = req.body as {
        barcode: string;
        expectedQty: number;
        name?: string;
        sku?: string;
      };

      let product = db.select().from(products).where(eq(products.barcode, barcode)).get();
      if (!product) {
        if (!name || !sku) {
          next(
            new AppError(
              `No product found for barcode "${barcode}"; provide "name" and "sku" to create one`,
              400,
            ),
          );
          return;
        }
        product = db.insert(products).values({ sku, barcode, name }).returning().get();
      }

      db.insert(sessionExpectedQuantities)
        .values({ sessionId: id, productId: product.id, expectedQty, source: 'manual' })
        .onConflictDoUpdate({
          target: [sessionExpectedQuantities.sessionId, sessionExpectedQuantities.productId],
          set: { expectedQty, source: 'manual', updatedAt: new Date().toISOString() },
        })
        .run();

      io?.to(`session:${id}`).emit(SOCKET_EVENTS.EXPECTED_QTY_UPDATED, { sessionId: id });

      res.status(201).json({ productId: product.id, expectedQty });
    } catch (err) {
      next(err);
    }
  };
}

export function deleteExpectedQuantity(db: AppDatabase, io?: SocketIOServer): RequestHandler {
  return (req, res, next) => {
    try {
      const id = Number(req.params.id);
      getSessionOrThrow(db, id);

      const productId = Number(req.params.productId);
      const deleted = db
        .delete(sessionExpectedQuantities)
        .where(
          and(
            eq(sessionExpectedQuantities.sessionId, id),
            eq(sessionExpectedQuantities.productId, productId),
          ),
        )
        .returning()
        .get();

      if (!deleted) {
        next(new AppError(`No expected-quantity entry for product ${productId} in session ${id}`, 404));
        return;
      }

      io?.to(`session:${id}`).emit(SOCKET_EVENTS.EXPECTED_QTY_UPDATED, { sessionId: id });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
