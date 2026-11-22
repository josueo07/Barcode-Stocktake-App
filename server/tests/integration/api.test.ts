import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { activateSession, createTestApp } from '../testApp';

describe('Stocktake API', () => {
  let ctx: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    ctx = createTestApp();
  });

  it('creates a session', async () => {
    const res = await request(ctx.app)
      .post('/api/sessions')
      .set(ctx.auth)
      .send({ name: 'Test Session' });

    expect(res.status).toBe(201);
    expect(res.body.session).toMatchObject({ name: 'Test Session', status: 'draft' });
  });

  it('rejects a session with a blank name', async () => {
    const res = await request(ctx.app).post('/api/sessions').set(ctx.auth).send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for a session that does not exist', async () => {
    const res = await request(ctx.app).get('/api/sessions/999999').set(ctx.auth);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/not found/i);
  });

  it('imports a CSV of expected quantities and lists them back', async () => {
    const sessionRes = await request(ctx.app)
      .post('/api/sessions')
      .set(ctx.auth)
      .send({ name: 'Import Test' });
    const sessionId = sessionRes.body.session.id;

    const csv =
      'sku,barcode,name,expected_qty\nSKU1,1111111111111,Widget,10\nSKU2,2222222222222,Gadget,5\n';

    const importRes = await request(ctx.app)
      .post(`/api/sessions/${sessionId}/import-csv`)
      .set(ctx.auth)
      .attach('file', Buffer.from(csv), 'products.csv');

    expect(importRes.status).toBe(200);
    expect(importRes.body.summary).toMatchObject({
      productsCreated: 2,
      expectedQuantitiesWritten: 2,
      rowsSkipped: 0,
    });

    const listRes = await request(ctx.app)
      .get(`/api/sessions/${sessionId}/expected-quantities`)
      .set(ctx.auth);
    expect(listRes.body.expectedQuantities).toHaveLength(2);
  });

  it('imports the valid rows of a CSV and reports errors for the invalid ones', async () => {
    const sessionRes = await request(ctx.app)
      .post('/api/sessions')
      .set(ctx.auth)
      .send({ name: 'Partial Import' });
    const sessionId = sessionRes.body.session.id;

    const csv =
      'sku,barcode,name,expected_qty\nSKU1,1111111111111,Widget,10\nSKU2,2222222222222,Gadget,not-a-number\n';

    const importRes = await request(ctx.app)
      .post(`/api/sessions/${sessionId}/import-csv`)
      .set(ctx.auth)
      .attach('file', Buffer.from(csv), 'products.csv');

    expect(importRes.body.summary.expectedQuantitiesWritten).toBe(1);
    expect(importRes.body.summary.rowsSkipped).toBe(1);
    expect(importRes.body.summary.errors).toHaveLength(1);
  });

  it('adds a manual expected quantity for a new barcode', async () => {
    const sessionRes = await request(ctx.app)
      .post('/api/sessions')
      .set(ctx.auth)
      .send({ name: 'Manual Entry Test' });
    const sessionId = sessionRes.body.session.id;

    const res = await request(ctx.app)
      .post(`/api/sessions/${sessionId}/expected-quantities`)
      .set(ctx.auth)
      .send({
        barcode: '3333333333333',
        expectedQty: 8,
        sku: 'SKU3',
        name: 'Manual Widget',
      });

    expect(res.status).toBe(201);

    const listRes = await request(ctx.app)
      .get(`/api/sessions/${sessionId}/expected-quantities`)
      .set(ctx.auth);
    expect(listRes.body.expectedQuantities).toHaveLength(1);
    expect(listRes.body.expectedQuantities[0]).toMatchObject({
      barcode: '3333333333333',
      expectedQty: 8,
    });
  });

  it('records a scan and reflects it in live counts', async () => {
    const sessionRes = await request(ctx.app)
      .post('/api/sessions')
      .set(ctx.auth)
      .send({ name: 'Scan Test' });
    const sessionId = sessionRes.body.session.id;
    activateSession(ctx.db, sessionId);

    const scan = {
      clientScanId: uuidv4(),
      barcode: '1234567890123',
      scannedAt: new Date().toISOString(),
    };

    const scanRes = await request(ctx.app)
      .post(`/api/sessions/${sessionId}/scans`)
      .set(ctx.auth)
      .send(scan);
    expect(scanRes.status).toBe(201);
    expect(scanRes.body.status).toBe('accepted');

    const countsRes = await request(ctx.app).get(`/api/sessions/${sessionId}/counts`).set(ctx.auth);
    expect(countsRes.body.counts).toEqual([
      expect.objectContaining({ barcode: '1234567890123', countedQty: 1 }),
    ]);
  });

  it('dedupes a retried scan submission by clientScanId', async () => {
    const sessionRes = await request(ctx.app)
      .post('/api/sessions')
      .set(ctx.auth)
      .send({ name: 'Dedupe Test' });
    const sessionId = sessionRes.body.session.id;
    activateSession(ctx.db, sessionId);

    const scan = {
      clientScanId: uuidv4(),
      barcode: '9999999999999',
      scannedAt: new Date().toISOString(),
    };

    await request(ctx.app).post(`/api/sessions/${sessionId}/scans`).set(ctx.auth).send(scan);
    const retryRes = await request(ctx.app)
      .post(`/api/sessions/${sessionId}/scans`)
      .set(ctx.auth)
      .send(scan);

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.status).toBe('duplicate');

    const countsRes = await request(ctx.app).get(`/api/sessions/${sessionId}/counts`).set(ctx.auth);
    expect(countsRes.body.counts[0].countedQty).toBe(1);
  });

  it('dedupes within a batch submission and reports per-item results', async () => {
    const sessionRes = await request(ctx.app)
      .post('/api/sessions')
      .set(ctx.auth)
      .send({ name: 'Batch Test' });
    const sessionId = sessionRes.body.session.id;
    activateSession(ctx.db, sessionId);

    const firstScanId = uuidv4();
    const scan = {
      clientScanId: firstScanId,
      barcode: '5555555555555',
      scannedAt: new Date().toISOString(),
    };
    await request(ctx.app).post(`/api/sessions/${sessionId}/scans`).set(ctx.auth).send(scan);

    const secondScanId = uuidv4();
    const batchRes = await request(ctx.app)
      .post(`/api/sessions/${sessionId}/scans/batch`)
      .set(ctx.auth)
      .send({ scans: [scan, { ...scan, clientScanId: secondScanId }] });

    expect(batchRes.body.results).toEqual([
      { clientScanId: firstScanId, status: 'duplicate' },
      { clientScanId: secondScanId, status: 'accepted' },
    ]);

    const countsRes = await request(ctx.app).get(`/api/sessions/${sessionId}/counts`).set(ctx.auth);
    expect(countsRes.body.counts[0].countedQty).toBe(2);
  });

  it('voids a scan and reflects the reduced count', async () => {
    const sessionRes = await request(ctx.app)
      .post('/api/sessions')
      .set(ctx.auth)
      .send({ name: 'Void Test' });
    const sessionId = sessionRes.body.session.id;
    activateSession(ctx.db, sessionId);

    const scan = {
      clientScanId: uuidv4(),
      barcode: '7777777777777',
      scannedAt: new Date().toISOString(),
    };
    await request(ctx.app).post(`/api/sessions/${sessionId}/scans`).set(ctx.auth).send(scan);

    const countsBefore = await request(ctx.app)
      .get(`/api/sessions/${sessionId}/counts`)
      .set(ctx.auth);
    const scanId = 1; // first scan event inserted overall in this test's fresh in-memory db

    const voidRes = await request(ctx.app)
      .delete(`/api/sessions/${sessionId}/scans/${scanId}`)
      .set(ctx.auth);
    expect(voidRes.status).toBe(204);

    const countsAfter = await request(ctx.app)
      .get(`/api/sessions/${sessionId}/counts`)
      .set(ctx.auth);
    expect(countsBefore.body.counts[0].countedQty).toBe(1);
    expect(countsAfter.body.counts).toHaveLength(0);
  });

  it('computes a variance report against expected quantities', async () => {
    const sessionRes = await request(ctx.app)
      .post('/api/sessions')
      .set(ctx.auth)
      .send({ name: 'Variance Test' });
    const sessionId = sessionRes.body.session.id;
    activateSession(ctx.db, sessionId);

    const csv = 'sku,barcode,name,expected_qty\nSKU1,1111111111111,Widget,10\n';
    await request(ctx.app)
      .post(`/api/sessions/${sessionId}/import-csv`)
      .set(ctx.auth)
      .attach('file', Buffer.from(csv), 'products.csv');

    for (let i = 0; i < 7; i += 1) {
      await request(ctx.app).post(`/api/sessions/${sessionId}/scans`).set(ctx.auth).send({
        clientScanId: uuidv4(),
        barcode: '1111111111111',
        scannedAt: new Date().toISOString(),
      });
    }

    const reportRes = await request(ctx.app)
      .get(`/api/sessions/${sessionId}/variance-report`)
      .set(ctx.auth);
    expect(reportRes.body.report.rows).toEqual([
      expect.objectContaining({
        barcode: '1111111111111',
        expectedQty: 10,
        countedQty: 7,
        variance: -3,
      }),
    ]);
    expect(reportRes.body.report.totals).toEqual({
      expectedQty: 10,
      countedQty: 7,
      variance: -3,
      expectedValueCents: null,
      countedValueCents: null,
      valueVarianceCents: null,
    });
  });

  it('exports the variance report as CSV', async () => {
    const sessionRes = await request(ctx.app)
      .post('/api/sessions')
      .set(ctx.auth)
      .send({ name: 'Export Test' });
    const sessionId = sessionRes.body.session.id;

    const res = await request(ctx.app)
      .get(`/api/sessions/${sessionId}/variance-report/export`)
      .set(ctx.auth);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text.split(/\r?\n/)[0]).toBe(
      '\uFEFFSKU,Código,Producto,Esperado,Contado,Diferencia',
    );
  });

  it('completing a session freezes a variance report snapshot', async () => {
    const sessionRes = await request(ctx.app)
      .post('/api/sessions')
      .set(ctx.auth)
      .send({ name: 'Completion Test' });
    const sessionId = sessionRes.body.session.id;
    activateSession(ctx.db, sessionId);

    const res = await request(ctx.app)
      .patch(`/api/sessions/${sessionId}`)
      .set(ctx.auth)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe('completed');
    expect(res.body.session.completedAt).toBeTruthy();
  });

  describe('Product CRUD', () => {
    it('creates, reads, updates, and deletes a product', async () => {
      const createRes = await request(ctx.app)
        .post('/api/products')
        .set(ctx.auth)
        .send({ sku: 'CRUD-1', barcode: '1000000000001', name: 'Widget', category: 'Test' });
      expect(createRes.status).toBe(201);
      const productId = createRes.body.product.id;

      const getRes = await request(ctx.app).get('/api/products/1000000000001').set(ctx.auth);
      expect(getRes.status).toBe(200);
      expect(getRes.body.product).toMatchObject({ sku: 'CRUD-1', name: 'Widget' });

      const updateRes = await request(ctx.app)
        .patch(`/api/products/${productId}`)
        .set(ctx.auth)
        .send({ name: 'Widget v2', category: 'Updated' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.product).toMatchObject({ name: 'Widget v2', category: 'Updated' });

      const deleteRes = await request(ctx.app).delete(`/api/products/${productId}`).set(ctx.auth);
      expect(deleteRes.status).toBe(204);

      const afterDelete = await request(ctx.app).get('/api/products/1000000000001').set(ctx.auth);
      expect(afterDelete.status).toBe(404);
    });

    it('rejects updating a product to a barcode that already exists', async () => {
      await request(ctx.app)
        .post('/api/products')
        .set(ctx.auth)
        .send({ sku: 'CRUD-A', barcode: '2000000000001', name: 'Product A' });
      const bRes = await request(ctx.app)
        .post('/api/products')
        .set(ctx.auth)
        .send({ sku: 'CRUD-B', barcode: '2000000000002', name: 'Product B' });

      const res = await request(ctx.app)
        .patch(`/api/products/${bRes.body.product.id}`)
        .set(ctx.auth)
        .send({ barcode: '2000000000001' });

      expect(res.status).toBe(409);
    });

    it('returns 404 when updating or deleting a product that does not exist', async () => {
      const updateRes = await request(ctx.app)
        .patch('/api/products/999999')
        .set(ctx.auth)
        .send({ name: 'x' });
      expect(updateRes.status).toBe(404);

      const deleteRes = await request(ctx.app).delete('/api/products/999999').set(ctx.auth);
      expect(deleteRes.status).toBe(404);
    });

    it('refuses to delete a product referenced by an expected-quantity row', async () => {
      const sessionRes = await request(ctx.app)
        .post('/api/sessions')
        .set(ctx.auth)
        .send({ name: 'Referenced Product Test' });
      const sessionId = sessionRes.body.session.id;

      const addRes = await request(ctx.app)
        .post(`/api/sessions/${sessionId}/expected-quantities`)
        .set(ctx.auth)
        .send({
          barcode: '3000000000001',
          expectedQty: 5,
          sku: 'CRUD-REF',
          name: 'Referenced Product',
        });
      const productId = addRes.body.productId;

      const deleteRes = await request(ctx.app).delete(`/api/products/${productId}`).set(ctx.auth);
      expect(deleteRes.status).toBe(409);
      expect(deleteRes.body.error.message).toMatch(/referenced by/i);
    });

    it('refuses to delete a product referenced by a scan event', async () => {
      const sessionRes = await request(ctx.app)
        .post('/api/sessions')
        .set(ctx.auth)
        .send({ name: 'Referenced Scan Test' });
      const sessionId = sessionRes.body.session.id;
      activateSession(ctx.db, sessionId);

      const productRes = await request(ctx.app)
        .post('/api/products')
        .set(ctx.auth)
        .send({ sku: 'CRUD-SCANNED', barcode: '3000000000002', name: 'Scanned Product' });

      await request(ctx.app).post(`/api/sessions/${sessionId}/scans`).set(ctx.auth).send({
        clientScanId: uuidv4(),
        barcode: '3000000000002',
        scannedAt: new Date().toISOString(),
      });

      const deleteRes = await request(ctx.app)
        .delete(`/api/products/${productRes.body.product.id}`)
        .set(ctx.auth);
      expect(deleteRes.status).toBe(409);
    });
  });

  describe('Session delete', () => {
    it('deletes a draft session', async () => {
      const sessionRes = await request(ctx.app)
        .post('/api/sessions')
        .set(ctx.auth)
        .send({ name: 'Draft To Delete' });
      const sessionId = sessionRes.body.session.id;

      const deleteRes = await request(ctx.app).delete(`/api/sessions/${sessionId}`).set(ctx.auth);
      expect(deleteRes.status).toBe(204);

      const getRes = await request(ctx.app).get(`/api/sessions/${sessionId}`).set(ctx.auth);
      expect(getRes.status).toBe(404);
    });

    it('refuses to delete an active or completed session', async () => {
      const sessionRes = await request(ctx.app)
        .post('/api/sessions')
        .set(ctx.auth)
        .send({ name: 'Active Session' });
      const sessionId = sessionRes.body.session.id;
      await request(ctx.app)
        .patch(`/api/sessions/${sessionId}`)
        .set(ctx.auth)
        .send({ status: 'active' });

      const deleteRes = await request(ctx.app).delete(`/api/sessions/${sessionId}`).set(ctx.auth);
      expect(deleteRes.status).toBe(409);

      const getRes = await request(ctx.app).get(`/api/sessions/${sessionId}`).set(ctx.auth);
      expect(getRes.status).toBe(200);
    });

    it('returns 404 when deleting a session that does not exist', async () => {
      const res = await request(ctx.app).delete('/api/sessions/999999').set(ctx.auth);
      expect(res.status).toBe(404);
    });
  });

  describe('Expected-quantity delete', () => {
    it('removes one expected-quantity row without affecting others', async () => {
      const sessionRes = await request(ctx.app)
        .post('/api/sessions')
        .set(ctx.auth)
        .send({ name: 'EQ Delete Test' });
      const sessionId = sessionRes.body.session.id;

      const keepRes = await request(ctx.app)
        .post(`/api/sessions/${sessionId}/expected-quantities`)
        .set(ctx.auth)
        .send({
          barcode: '4000000000001',
          expectedQty: 10,
          sku: 'EQ-KEEP',
          name: 'Keep Me',
        });
      const removeRes = await request(ctx.app)
        .post(`/api/sessions/${sessionId}/expected-quantities`)
        .set(ctx.auth)
        .send({
          barcode: '4000000000002',
          expectedQty: 20,
          sku: 'EQ-REMOVE',
          name: 'Remove Me',
        });

      const deleteRes = await request(ctx.app)
        .delete(`/api/sessions/${sessionId}/expected-quantities/${removeRes.body.productId}`)
        .set(ctx.auth);
      expect(deleteRes.status).toBe(204);

      const listRes = await request(ctx.app)
        .get(`/api/sessions/${sessionId}/expected-quantities`)
        .set(ctx.auth);
      expect(listRes.body.expectedQuantities).toHaveLength(1);
      expect(listRes.body.expectedQuantities[0].productId).toBe(keepRes.body.productId);
    });

    it('returns 404 removing an expected-quantity row that does not exist', async () => {
      const sessionRes = await request(ctx.app)
        .post('/api/sessions')
        .set(ctx.auth)
        .send({ name: 'EQ Delete 404 Test' });
      const sessionId = sessionRes.body.session.id;

      const res = await request(ctx.app)
        .delete(`/api/sessions/${sessionId}/expected-quantities/999999`)
        .set(ctx.auth);
      expect(res.status).toBe(404);
    });
  });

  describe('Scan events list', () => {
    it('lists raw scan events for a session, most recent first', async () => {
      const sessionRes = await request(ctx.app)
        .post('/api/sessions')
        .set(ctx.auth)
        .send({ name: 'Scan List Test' });
      const sessionId = sessionRes.body.session.id;
      activateSession(ctx.db, sessionId);

      const first = {
        clientScanId: uuidv4(),
        barcode: '5000000000001',
        scannedAt: '2026-01-01T00:00:00.000Z',
      };
      const second = {
        clientScanId: uuidv4(),
        barcode: '5000000000002',
        scannedAt: '2026-01-01T00:05:00.000Z',
      };
      await request(ctx.app).post(`/api/sessions/${sessionId}/scans`).set(ctx.auth).send(first);
      await request(ctx.app).post(`/api/sessions/${sessionId}/scans`).set(ctx.auth).send(second);

      const listRes = await request(ctx.app).get(`/api/sessions/${sessionId}/scans`).set(ctx.auth);
      expect(listRes.status).toBe(200);
      expect(listRes.body.scans).toHaveLength(2);
      expect(listRes.body.scans[0].barcode).toBe('5000000000002');
      expect(listRes.body.scans[1].barcode).toBe('5000000000001');
    });

    it('returns an empty list for a session with no scans', async () => {
      const sessionRes = await request(ctx.app)
        .post('/api/sessions')
        .set(ctx.auth)
        .send({ name: 'Empty Scan List Test' });
      const sessionId = sessionRes.body.session.id;

      const listRes = await request(ctx.app).get(`/api/sessions/${sessionId}/scans`).set(ctx.auth);
      expect(listRes.status).toBe(200);
      expect(listRes.body.scans).toEqual([]);
    });
  });
});
