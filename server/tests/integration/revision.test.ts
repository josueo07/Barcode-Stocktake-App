import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createTestApp } from '../testApp';

function scan(barcode: string, quantity = 1) {
  return { clientScanId: uuidv4(), barcode, quantity, scannedAt: new Date().toISOString() };
}

describe('Fixes from the app review', () => {
  let ctx: ReturnType<typeof createTestApp>;

  const newActiveSession = async (name: string) => {
    const res = await request(ctx.app).post('/api/sessions').set(ctx.auth).send({ name });
    const id = res.body.session.id as number;
    await request(ctx.app).patch(`/api/sessions/${id}`).set(ctx.auth).send({ status: 'active' });
    return id;
  };

  beforeEach(() => {
    ctx = createTestApp();
  });

  it("won't remove a closed count's scan through another count's URL", async () => {
    const closed = await newActiveSession('Cerrado');
    await request(ctx.app).post(`/api/sessions/${closed}/scans`).set(ctx.auth).send(scan('111'));
    const scans = await request(ctx.app).get(`/api/sessions/${closed}/scans`).set(ctx.auth);
    const scanId = scans.body.scans[0].id as number;
    await request(ctx.app)
      .patch(`/api/sessions/${closed}`)
      .set(ctx.auth)
      .send({ status: 'completed' });

    const open = await newActiveSession('Abierto');
    const res = await request(ctx.app)
      .delete(`/api/sessions/${open}/scans/${scanId}`)
      .set(ctx.auth);
    expect(res.status).toBe(404);

    const after = await request(ctx.app).get(`/api/sessions/${closed}/scans`).set(ctx.auth);
    expect(after.body.scans).toHaveLength(1);
  });

  it('rejects a blank barcode', async () => {
    const id = await newActiveSession('Vacío');
    const res = await request(ctx.app)
      .post(`/api/sessions/${id}/scans`)
      .set(ctx.auth)
      .send(scan('   '));
    expect(res.status).toBe(400);
  });

  it('adds up the counted total across leading-zero forms of the same product', async () => {
    const id = await newActiveSession('Ceros');
    await request(ctx.app)
      .post(`/api/sessions/${id}/scans`)
      .set(ctx.auth)
      .send({ ...scan('300450123456', 2), newProductName: 'Producto' });
    await request(ctx.app)
      .post(`/api/sessions/${id}/scans`)
      .set(ctx.auth)
      .send(scan('0300450123456', 3));

    const counts = await request(ctx.app).get(`/api/sessions/${id}/counts`).set(ctx.auth);
    expect(counts.body.counts).toHaveLength(1);
    expect(counts.body.counts[0].countedQty).toBe(5);
  });
});
