import type { RequestHandler } from 'express';
import { and, eq } from 'drizzle-orm';
import type { Server as SocketIOServer } from 'socket.io';
import { SOCKET_EVENTS, type SessionStatus } from '@barcode-stocktake/shared';
import type { AppDatabase } from '../db/client';
import { products, sessionExpectedQuantities, stocktakeSessions } from '../db/schema';
import { AppError } from '../middleware/errorHandler';
import { importInventoryFile } from '../services/csvImport.service';
import { persistVarianceReportSnapshot } from '../services/varianceReport.service';

/** The only status changes allowed: a count starts once and closes once, never reopens. */
const ALLOWED_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  draft: ['active'],
  active: ['completed'],
  completed: [],
};

function assertNotCompleted(session: { id: number; status: SessionStatus }) {
  if (session.status === 'completed') {
    throw new AppError('Este conteo está cerrado; ya no se pueden cambiar los esperados.', 409);
  }
}

function getSessionOrThrow(db: AppDatabase, id: number) {
  const session = db.select().from(stocktakeSessions).where(eq(stocktakeSessions.id, id)).get();
  if (!session) {
    throw new AppError(`Conteo ${id} no encontrado (not found)`, 404);
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
    const { name, notes, costEnabled } = req.body as {
      name: string;
      notes?: string | null;
      costEnabled?: boolean;
    };
    const session = db
      .insert(stocktakeSessions)
      .values({ name, notes: notes ?? null, costEnabled: costEnabled ?? false, status: 'draft' })
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

      const { name, notes, status, costEnabled } = req.body as {
        name?: string;
        notes?: string | null;
        status?: SessionStatus;
        costEnabled?: boolean;
      };

      const updates: Partial<typeof stocktakeSessions.$inferInsert> = {};
      if (name !== undefined) updates.name = name;
      if (notes !== undefined) updates.notes = notes;
      if (costEnabled !== undefined && costEnabled !== existing.costEnabled) {
        assertNotCompleted(existing);
        updates.costEnabled = costEnabled;
      }
      if (status !== undefined && status !== existing.status) {
        if (!ALLOWED_TRANSITIONS[existing.status].includes(status)) {
          throw new AppError(
            'Ese cambio no está permitido: un conteo va de borrador a en curso a cerrado, y no se puede reabrir.',
            409,
          );
        }
        updates.status = status;
        if (status === 'active' && !existing.startedAt) {
          updates.startedAt = new Date().toISOString();
        }
        if (status === 'completed') {
          updates.completedAt = new Date().toISOString();
        }
      }

      if (Object.keys(updates).length === 0) {
        res.json({ session: existing });
        return;
      }

      const session = db
        .update(stocktakeSessions)
        .set(updates)
        .where(eq(stocktakeSessions.id, id))
        .returning()
        .get();

      const statusChanged = status !== undefined && status !== existing.status;
      if (statusChanged && status === 'completed') {
        persistVarianceReportSnapshot(db, id);
      }

      if (statusChanged) {
        io?.to(`session:${id}`).emit(SOCKET_EVENTS.STATUS_CHANGED, {
          sessionId: id,
          status: session.status,
        });
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

      if (existing.status !== 'draft' && req.query.confirm !== 'true') {
        next(
          new AppError(
            'Confirma el borrado permanente de este conteo y sus datos.',
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
  return async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      assertNotCompleted(getSessionOrThrow(db, id));

      if (!req.file) {
        next(new AppError('Falta el archivo (Excel o CSV).', 400));
        return;
      }

      const selection: unknown = req.body.quantityColumn;
      if (selection !== undefined && (typeof selection !== 'string' || !/^\d+$/.test(selection))) {
        next(new AppError('Selecciona una columna válida de cantidad esperada.', 400));
        return;
      }
      const summary = await importInventoryFile(db, id, req.file.buffer, req.file.originalname, {
        requireQuantity: req.body.requireQuantity === 'true',
        quantityColumn: selection === undefined ? undefined : Number(selection),
      });
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
      assertNotCompleted(getSessionOrThrow(db, id));

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
              `El código "${barcode}" no existe; escribe nombre y SKU para crearlo.`,
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
      assertNotCompleted(getSessionOrThrow(db, id));

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
        next(
          new AppError(`No expected-quantity entry for product ${productId} in session ${id}`, 404),
        );
        return;
      }

      io?.to(`session:${id}`).emit(SOCKET_EVENTS.EXPECTED_QTY_UPDATED, { sessionId: id });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
