import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { scanEvents } from '../../src/db/schema';
import { TEST_PIN, createTestApp } from '../testApp';

describe('Authentication and roles', () => {
  let ctx: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    ctx = createTestApp();
  });

  it('keeps health public but rejects API calls without a token', async () => {
    expect((await request(ctx.app).get('/api/health')).status).toBe(200);
    expect((await request(ctx.app).get('/api/sessions')).status).toBe(401);
    expect(
      (await request(ctx.app).get('/api/sessions').set('Authorization', 'Bearer nope')).status,
    ).toBe(401);
  });

  it('logs in with username and PIN, and rejects a wrong PIN', async () => {
    const ok = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'Counter', pin: TEST_PIN });
    expect(ok.status).toBe(200);
    expect(ok.body.user).toMatchObject({ username: 'counter', role: 'counter' });
    expect(ok.body.user.pinHash).toBeUndefined();

    const me = await request(ctx.app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ok.body.token}`);
    expect(me.body.user.username).toBe('counter');

    const bad = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'counter', pin: 'wrong-pin' });
    expect(bad.status).toBe(401);
  });

  it('locks a username after repeated failed logins', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(ctx.app)
        .post('/api/auth/login')
        .send({ username: 'counter', pin: 'wrong-pin' });
    }
    const locked = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'counter', pin: TEST_PIN });
    expect(locked.status).toBe(429);
  });

  it('logout revokes the token', async () => {
    const res = await request(ctx.app).post('/api/auth/logout').set(ctx.counter.header);
    expect(res.status).toBe(204);
    expect((await request(ctx.app).get('/api/auth/me').set(ctx.counter.header)).status).toBe(401);
  });

  it('lets a counter scan but not manage sessions, products, reports or users', async () => {
    const session = await request(ctx.app).post('/api/sessions').set(ctx.auth).send({ name: 'S' });
    const id = session.body.session.id;

    const scan = await request(ctx.app)
      .post(`/api/sessions/${id}/scans`)
      .set(ctx.counter.header)
      .send({
        clientScanId: uuidv4(),
        barcode: '0123456789012',
        scannedAt: new Date().toISOString(),
      });
    expect(scan.status).toBe(201);

    const forbidden = [
      request(ctx.app).post('/api/sessions').send({ name: 'X' }),
      request(ctx.app).patch(`/api/sessions/${id}`).send({ status: 'completed' }),
      request(ctx.app).delete(`/api/sessions/${id}`),
      request(ctx.app).post('/api/products').send({ sku: 'A', barcode: '1', name: 'A' }),
      request(ctx.app).get(`/api/sessions/${id}/variance-report`),
      request(ctx.app).get('/api/users'),
    ];
    for (const req of forbidden) {
      expect((await req.set(ctx.counter.header)).status).toBe(403);
    }
  });

  it('records which user submitted each scan', async () => {
    const session = await request(ctx.app).post('/api/sessions').set(ctx.auth).send({ name: 'S' });
    const id = session.body.session.id;
    await request(ctx.app)
      .post(`/api/sessions/${id}/scans/batch`)
      .set(ctx.counter.header)
      .send({
        scans: [{ clientScanId: uuidv4(), barcode: '111', scannedAt: new Date().toISOString() }],
      });
    const rows = ctx.db.select().from(scanEvents).where(eq(scanEvents.sessionId, id)).all();
    expect(rows[0].userId).toBe(ctx.counter.user.id);
  });

  it('lets a supervisor add a counter, and deactivating them signs them out', async () => {
    const created = await request(ctx.app)
      .post('/api/users')
      .set(ctx.auth)
      .send({ username: 'maria', displayName: 'María', role: 'counter', pin: '246810' });
    expect(created.status).toBe(201);
    expect(created.body.user).toMatchObject({ username: 'maria', active: true });

    const login = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'maria', pin: '246810' });
    const header = { Authorization: `Bearer ${login.body.token}` };
    expect((await request(ctx.app).get('/api/sessions').set(header)).status).toBe(200);

    await request(ctx.app)
      .patch(`/api/users/${created.body.user.id}`)
      .set(ctx.auth)
      .send({ active: false });
    expect((await request(ctx.app).get('/api/sessions').set(header)).status).toBe(401);
  });

  it('rejects PINs shorter than 6 characters and supervisors demoting themselves', async () => {
    const short = await request(ctx.app)
      .post('/api/users')
      .set(ctx.auth)
      .send({ username: 'x', displayName: 'X', role: 'counter', pin: '123' });
    expect(short.status).toBe(400);

    const self = await request(ctx.app)
      .patch(`/api/users/${ctx.supervisor.user.id}`)
      .set(ctx.auth)
      .send({ role: 'counter' });
    expect(self.status).toBe(400);
  });
});
