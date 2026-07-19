import { createApp } from '../src/app';
import { createTestDatabase } from './testDb';

export function createTestApp() {
  const { db, sqlite } = createTestDatabase();
  const app = createApp({ db });
  return { app, db, sqlite };
}
