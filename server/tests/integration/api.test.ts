import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createTestApp } from '../testApp';

describe('Stocktake API', () => {
  let ctx: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    ctx = createTestApp();
  });

  it('creates a session', async () => {
    const res = await request(ctx.app).post('/api/sessions').send({ name: 'Test Session' });

    expect(res.status).toBe(201);
    expect(res.body.session).toMatchObject({ name: 'Test Session', status: 'draft' });
  });

  it('rejects a session with a blank name', async () => {
    const res = await request(ctx.app).post('/api/sessions').send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for a session that does not exist', async () => {
    const res = await request(ctx.app).get('/api/sessions/999999');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/not found/i);
  });

  it('imports a CSV of expected quantities and lists them back', async () => {
    const sessionRes = await request(ctx.app).post('/api/sessions').send({ name: 'Import Test' });
    const sessionId = sessionRes.body.session.id;

    const csv =
      'sku,barcode,name,expected_qty\nSKU1,1111111111111,Widget,10\nSKU2,2222222222222,Gadget,5\n';

    const importRes = await request(ctx.app)
      .post(`/api/sessions/${sessionId}/import-csv`)
      .attach('file', Buffer.from(csv), 'products.csv');

    expect(importRes.status).toBe(200);
    expect(importRes.body.summary).toMatchObject({
      productsCreated: 2,
      expectedQuantitiesWritten: 2,
      rowsSkipped: 0,
    });

    const listRes = await request(ctx.app).get(`/api/sessions/${sessionId}/expected-quantities`);
    expect(listRes.body.expectedQuantities).toHaveLength(2);
  });

  it('imports the valid rows of a CSV and reports errors for the invalid ones', async () => {
    const sessionRes = await request(ctx.app).post('/api/sessions').send({ name: 'Partial Import' });
    const sessionId = sessionRes.body.session.id;

    const csv =
      'sku,barcode,name,expected_qty\nSKU1,1111111111111,Widget,10\nSKU2,2222222222222,Gadget,not-a-number\n';

    const importRes = await request(ctx.app)
      .post(`/api/sessions/${sessionId}/import-csv`)
      .attach('file', Buffer.from(csv), 'products.csv');

    expect(importRes.body.summary.expectedQuantitiesWritten).toBe(1);
    expect(importRes.body.summary.rowsSkipped).toBe(1);
    expect(importRes.body.summary.errors).toHaveLength(1);
  });

  it('adds a manual expected quantity for a new barcode', async () => {
    const sessionRes = await request(ctx.app).post('/api/sessions').send({ name: 'Manual Entry Test' });
    const sessionId = sessionRes.body.session.id;

    const res = await request(ctx.app).post(`/api/sessions/${sessionId}/expected-quantities`).send({
      barcode: '3333333333333',
      expectedQty: 8,
      sku: 'SKU3',
      name: 'Manual Widget',
    });

    expect(res.status).toBe(201);

    const listRes = await request(ctx.app).get(`/api/sessions/${sessionId}/expected-quantities`);
    expect(listRes.body.expectedQuantities).toHaveLength(1);
    expect(listRes.body.expectedQuantities[0]).toMatchObject({ barcode: '3333333333333', expectedQty: 8 });
  });

  it('records a scan and reflects it in live counts', async () => {
    const sessionRes = await request(ctx.app).post('/api/sessions').send({ name: 'Scan Test' });
    const sessionId = sessionRes.body.session.id;

    const scan = {
      clientScanId: uuidv4(),
      barcode: '1234567890123',
      scannedAt: new Date().toISOString(),
    };

    const scanRes = await request(ctx.app).post(`/api/sessions/${sessionId}/scans`).send(scan);
    expect(scanRes.status).toBe(201);
    expect(scanRes.body.status).toBe('accepted');

    const countsRes = await request(ctx.app).get(`/api/sessions/${sessionId}/counts`);
    expect(countsRes.body.counts).toEqual([
      expect.objectContaining({ barcode: '1234567890123', countedQty: 1 }),
    ]);
  });

  it('dedupes a retried scan submission by clientScanId', async () => {
    const sessionRes = await request(ctx.app).post('/api/sessions').send({ name: 'Dedupe Test' });
    const sessionId = sessionRes.body.session.id;

    const scan = {
      clientScanId: uuidv4(),
      barcode: '9999999999999',
      scannedAt: new Date().toISOString(),
    };

    await request(ctx.app).post(`/api/sessions/${sessionId}/scans`).send(scan);
    const retryRes = await request(ctx.app).post(`/api/sessions/${sessionId}/scans`).send(scan);

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.status).toBe('duplicate');

    const countsRes = await request(ctx.app).get(`/api/sessions/${sessionId}/counts`);
    expect(countsRes.body.counts[0].countedQty).toBe(1);
  });

  it('dedupes within a batch submission and reports per-item results', async () => {
    const sessionRes = await request(ctx.app).post('/api/sessions').send({ name: 'Batch Test' });
    const sessionId = sessionRes.body.session.id;

    const firstScanId = uuidv4();
    const scan = { clientScanId: firstScanId, barcode: '5555555555555', scannedAt: new Date().toISOString() };
    await request(ctx.app).post(`/api/sessions/${sessionId}/scans`).send(scan);

    const secondScanId = uuidv4();
    const batchRes = await request(ctx.app)
      .post(`/api/sessions/${sessionId}/scans/batch`)
      .send({ scans: [scan, { ...scan, clientScanId: secondScanId }] });

    expect(batchRes.body.results).toEqual([
      { clientScanId: firstScanId, status: 'duplicate' },
      { clientScanId: secondScanId, status: 'accepted' },
    ]);

    const countsRes = await request(ctx.app).get(`/api/sessions/${sessionId}/counts`);
    expect(countsRes.body.counts[0].countedQty).toBe(2);
  });

  it('voids a scan and reflects the reduced count', async () => {
    const sessionRes = await request(ctx.app).post('/api/sessions').send({ name: 'Void Test' });
    const sessionId = sessionRes.body.session.id;

    const scan = { clientScanId: uuidv4(), barcode: '7777777777777', scannedAt: new Date().toISOString() };
    await request(ctx.app).post(`/api/sessions/${sessionId}/scans`).send(scan);

    const countsBefore = await request(ctx.app).get(`/api/sessions/${sessionId}/counts`);
    const scanId = 1; // first scan event inserted overall in this test's fresh in-memory db

    const voidRes = await request(ctx.app).delete(`/api/sessions/${sessionId}/scans/${scanId}`);
    expect(voidRes.status).toBe(204);

    const countsAfter = await request(ctx.app).get(`/api/sessions/${sessionId}/counts`);
    expect(countsBefore.body.counts[0].countedQty).toBe(1);
    expect(countsAfter.body.counts).toHaveLength(0);
  });

  it('computes a variance report against expected quantities', async () => {
    const sessionRes = await request(ctx.app).post('/api/sessions').send({ name: 'Variance Test' });
    const sessionId = sessionRes.body.session.id;

    const csv = 'sku,barcode,name,expected_qty\nSKU1,1111111111111,Widget,10\n';
    await request(ctx.app)
      .post(`/api/sessions/${sessionId}/import-csv`)
      .attach('file', Buffer.from(csv), 'products.csv');

    for (let i = 0; i < 7; i += 1) {
      await request(ctx.app)
        .post(`/api/sessions/${sessionId}/scans`)
        .send({ clientScanId: uuidv4(), barcode: '1111111111111', scannedAt: new Date().toISOString() });
    }

    const reportRes = await request(ctx.app).get(`/api/sessions/${sessionId}/variance-report`);
    expect(reportRes.body.report.rows).toEqual([
      expect.objectContaining({ barcode: '1111111111111', expectedQty: 10, countedQty: 7, variance: -3 }),
    ]);
    expect(reportRes.body.report.totals).toEqual({ expectedQty: 10, countedQty: 7, variance: -3 });
  });

  it('exports the variance report as CSV', async () => {
    const sessionRes = await request(ctx.app).post('/api/sessions').send({ name: 'Export Test' });
    const sessionId = sessionRes.body.session.id;

    const res = await request(ctx.app).get(`/api/sessions/${sessionId}/variance-report/export`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text.split('\n')[0]).toBe('SKU,Barcode,Name,Expected Qty,Counted Qty,Variance');
  });

  it('completing a session freezes a variance report snapshot', async () => {
    const sessionRes = await request(ctx.app).post('/api/sessions').send({ name: 'Completion Test' });
    const sessionId = sessionRes.body.session.id;

    const res = await request(ctx.app)
      .patch(`/api/sessions/${sessionId}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe('completed');
    expect(res.body.session.completedAt).toBeTruthy();
  });
});
