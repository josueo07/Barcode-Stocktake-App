import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { getSession, listSessions } from '../../src/api/sessions';
import { config } from '../../src/config';
import { offlineDb } from '../../src/db/offlineQueue';
import { server } from '../mocks/server';

const session = {
  id: 3,
  name: 'Conteo anual',
  status: 'active' as const,
  notes: null,
  startedAt: null,
  completedAt: null,
  createdAt: new Date().toISOString(),
};

describe('opening sessions without a connection', () => {
  beforeEach(async () => {
    await offlineDb.sessions.clear();
  });

  it('falls back to the saved copy when the server cannot be reached', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/sessions/3`, () => HttpResponse.json({ session })),
    );
    expect(await getSession(3)).toEqual(session);

    server.use(http.get(`${config.apiBaseUrl}/api/sessions/3`, () => HttpResponse.error()));
    expect(await getSession(3)).toEqual(session);

    server.use(http.get(`${config.apiBaseUrl}/api/sessions`, () => HttpResponse.error()));
    expect(await listSessions()).toEqual([session]);
  });

  it('does not hide real server answers such as 404', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/sessions/3`, () => HttpResponse.json({ session })),
    );
    await getSession(3);
    server.use(
      http.get(`${config.apiBaseUrl}/api/sessions/3`, () =>
        HttpResponse.json({ error: { message: 'Session 3 not found' } }, { status: 404 }),
      ),
    );
    await expect(getSession(3)).rejects.toThrow(/not found/);
  });
});
