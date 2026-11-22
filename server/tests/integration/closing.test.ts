import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createTestApp } from '../testApp';

function scan(barcode: string) {
  return { clientScanId: uuidv4(), barcode, scannedAt: new Date().toISOString() };
}

describe('Server-enforced session closing', () => {
  let ctx: ReturnType<typeof createTestApp>;
  let id: number;

  const setStatus = (status: string) =>
    request(ctx.app).patch(`/api/sessions/${id}`).set(ctx.auth).send({ status });
  const counts = async () =>
    (await request(ctx.app).get(`/api/sessions/${id}/counts`).set(ctx.auth)).body.counts;

  beforeEach(async () => {
    ctx = createTestApp();
    const res = await request(ctx.app).post('/api/sessions').set(ctx.auth).send({ name: 'Cierre' });
    id = res.body.session.id;
  });

  it('only allows draft → active → completed, and never reopens', async () => {
    expect((await setStatus('completed')).status).toBe(409);
    expect((await setStatus('active')).status).toBe(200);
    expect((await setStatus('draft')).status).toBe(409);
    expect((await setStatus('completed')).status).toBe(200);
    expect((await setStatus('active')).status).toBe(409);
    expect((await setStatus('draft')).status).toBe(409);
    // Re-sending the current status is a harmless no-op.
    expect((await setStatus('completed')).status).toBe(200);
  });

  it('rejects scans before the count starts', async () => {
    const res = await request(ctx.app)
      .post(`/api/sessions/${id}/scans`)
      .set(ctx.counter.header)
      .send(scan('111'));
    expect(res.status).toBe(409);

    const batch = await request(ctx.app)
      .post(`/api/sessions/${id}/scans/batch`)
      .set(ctx.counter.header)
      .send({ scans: [scan('111')] });
    expect(batch.body.results[0].status).toBe('error');
  });

  it('holds scans that arrive after closing as late, outside the count and report', async () => {
    await setStatus('active');
    await request(ctx.app)
      .post(`/api/sessions/${id}/scans`)
      .set(ctx.counter.header)
      .send(scan('111'));
    await setStatus('completed');

    const late = await request(ctx.app)
      .post(`/api/sessions/${id}/scans/batch`)
      .set(ctx.counter.header)
      .send({ scans: [scan('111'), scan('222')] });
    expect(late.body.results.map((r: { status: string }) => r.status)).toEqual(['late', 'late']);

    expect(await counts()).toEqual([expect.objectContaining({ barcode: '111', countedQty: 1 })]);

    const report = await request(ctx.app).get(`/api/sessions/${id}/variance-report`).set(ctx.auth);
    expect(report.body.report.rows).toHaveLength(1);

    const list = await request(ctx.app).get(`/api/sessions/${id}/late-scans`).set(ctx.auth);
    expect(list.body.scans).toHaveLength(2);
    expect(list.body.scans[0]).toMatchObject({ late: true, userId: ctx.counter.user.id });
  });

  it('lets a supervisor accept late scans into the closed count', async () => {
    await setStatus('active');
    await setStatus('completed');
    await request(ctx.app)
      .post(`/api/sessions/${id}/scans/batch`)
      .set(ctx.counter.header)
      .send({ scans: [scan('111'), scan('222')] });
    const list = await request(ctx.app).get(`/api/sessions/${id}/late-scans`).set(ctx.auth);
    const firstId = list.body.scans.find((s: { barcode: string }) => s.barcode === '111').id;

    const forbidden = await request(ctx.app)
      .post(`/api/sessions/${id}/late-scans/accept`)
      .set(ctx.counter.header)
      .send({ scanIds: [firstId] });
    expect(forbidden.status).toBe(403);

    const accepted = await request(ctx.app)
      .post(`/api/sessions/${id}/late-scans/accept`)
      .set(ctx.auth)
      .send({ scanIds: [firstId] });
    expect(accepted.body.accepted).toBe(1);

    expect(await counts()).toEqual([expect.objectContaining({ barcode: '111', countedQty: 1 })]);
    const remaining = await request(ctx.app).get(`/api/sessions/${id}/late-scans`).set(ctx.auth);
    expect(remaining.body.scans).toHaveLength(1);
  });

  it('freezes expected quantities and scans once closed', async () => {
    await request(ctx.app)
      .post(`/api/sessions/${id}/expected-quantities`)
      .set(ctx.auth)
      .send({ barcode: '111', expectedQty: 3, sku: 'A', name: 'A' });
    await setStatus('active');
    const s = await request(ctx.app)
      .post(`/api/sessions/${id}/scans`)
      .set(ctx.counter.header)
      .send(scan('111'));
    expect(s.status).toBe(201);
    await setStatus('completed');

    const add = await request(ctx.app)
      .post(`/api/sessions/${id}/expected-quantities`)
      .set(ctx.auth)
      .send({ barcode: '222', expectedQty: 1, sku: 'B', name: 'B' });
    expect(add.status).toBe(409);

    const csv = await request(ctx.app)
      .post(`/api/sessions/${id}/import-csv`)
      .set(ctx.auth)
      .attach('file', Buffer.from('sku,barcode,name,expected_qty\nC,333,C,1\n'), 'x.csv');
    expect(csv.status).toBe(409);

    const expected = await request(ctx.app)
      .get(`/api/sessions/${id}/expected-quantities`)
      .set(ctx.auth);
    const productId = expected.body.expectedQuantities[0].productId;
    const del = await request(ctx.app)
      .delete(`/api/sessions/${id}/expected-quantities/${productId}`)
      .set(ctx.auth);
    expect(del.status).toBe(409);

    const scans = await request(ctx.app).get(`/api/sessions/${id}/scans`).set(ctx.auth);
    const voided = await request(ctx.app)
      .delete(`/api/sessions/${id}/scans/${scans.body.scans[0].id}`)
      .set(ctx.auth);
    expect(voided.status).toBe(409);
  });
});
