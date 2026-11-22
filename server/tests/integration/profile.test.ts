import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createUser, login } from '../../src/services/auth.service';
import { createTestApp, TEST_PIN } from '../testApp';

describe('One supervisor, many counters', () => {
  let ctx: ReturnType<typeof createTestApp>;
  beforeEach(() => {
    ctx = createTestApp();
  });

  it('refuses a second supervisor but allows many counters', async () => {
    const second = await request(ctx.app)
      .post('/api/users')
      .set(ctx.auth)
      .send({ username: 'otra', displayName: 'Otra', role: 'supervisor', pin: '123456' });
    expect(second.status).toBe(409);
    expect(JSON.stringify(second.body)).toMatch(/solo puede haber uno/i);

    for (const name of ['ana', 'luis', 'marta']) {
      const res = await request(ctx.app)
        .post('/api/users')
        .set(ctx.auth)
        .send({ username: name, displayName: name, role: 'counter', pin: '123456' });
      expect(res.status).toBe(201);
    }
    expect(() =>
      createUser(ctx.db, { username: 'x', displayName: 'X', role: 'supervisor', pin: '123456' }),
    ).toThrow(/supervisor/);
  });

  it('refuses promoting a counter while a supervisor is active', async () => {
    const res = await request(ctx.app)
      .patch(`/api/users/${ctx.counter.user.id}`)
      .set(ctx.auth)
      .send({ role: 'supervisor' });
    expect(res.status).toBe(409);
  });
});

describe('My profile', () => {
  let ctx: ReturnType<typeof createTestApp>;
  beforeEach(() => {
    ctx = createTestApp();
  });

  it('lets a counter rename themselves and see their stats', async () => {
    const renamed = await request(ctx.app)
      .patch('/api/auth/me')
      .set(ctx.counter.header)
      .send({ displayName: 'Ana Rivera' });
    expect(renamed.body.user).toMatchObject({ displayName: 'Ana Rivera', role: 'counter' });

    const session = (await request(ctx.app).post('/api/sessions').set(ctx.auth).send({ name: 'C' }))
      .body.session.id;
    await request(ctx.app)
      .patch(`/api/sessions/${session}`)
      .set(ctx.auth)
      .send({ status: 'active' });
    await request(ctx.app).post(`/api/sessions/${session}/scans`).set(ctx.counter.header).send({
      clientScanId: '6c1f0a0e-4b7e-4f5c-9f1a-2a3b4c5d6e7f',
      barcode: '111',
      quantity: 4,
      scannedAt: '2026-11-22T10:00:00.000Z',
    });
    const stats = await request(ctx.app).get('/api/auth/me/stats').set(ctx.counter.header);
    expect(stats.body.stats).toEqual({
      scans: 1,
      units: 4,
      sessions: 1,
      lastScanAt: '2026-11-22T10:00:00.000Z',
    });
  });

  it('changes the PIN only with the current one, and signs out other phones', async () => {
    const otherPhone = login(ctx.db, 'counter', TEST_PIN)!;

    const wrong = await request(ctx.app)
      .post('/api/auth/me/pin')
      .set(ctx.counter.header)
      .send({ currentPin: 'nope', newPin: '654321' });
    expect(wrong.status).toBe(400);

    const ok = await request(ctx.app)
      .post('/api/auth/me/pin')
      .set(ctx.counter.header)
      .send({ currentPin: TEST_PIN, newPin: '654321' });
    expect(ok.status).toBe(204);

    expect((await request(ctx.app).get('/api/auth/me').set(ctx.counter.header)).status).toBe(200);
    expect(
      (
        await request(ctx.app)
          .get('/api/auth/me')
          .set({ Authorization: `Bearer ${otherPhone.token}` })
      ).status,
    ).toBe(401);
    expect(login(ctx.db, 'counter', '654321')).not.toBeNull();
  });
});
