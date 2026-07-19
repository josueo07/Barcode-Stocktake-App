import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env';
import { importCsv } from '../services/csvImport.service';
import { logger } from '../utils/logger';
import { createDatabase } from './client';
import { stocktakeSessions } from './schema';

const { db, sqlite } = createDatabase(env.databasePath);

const existingSessions = db.select().from(stocktakeSessions).all();
if (existingSessions.length > 0) {
  logger.info('Database already has sessions; skipping seed. Delete the .sqlite file to reseed.');
  sqlite.close();
  process.exit(0);
}

const session = db
  .insert(stocktakeSessions)
  .values({ name: 'Demo Stocktake', status: 'draft' })
  .returning()
  .get();

const csvPath = path.resolve(__dirname, '..', '..', '..', 'sample-data', 'sample-products.csv');
const csvBuffer = fs.readFileSync(csvPath);
const summary = importCsv(db, session.id, csvBuffer);

logger.info({ summary }, `Seeded demo session "${session.name}" (id=${session.id})`);
sqlite.close();
