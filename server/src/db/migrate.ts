import path from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { createDatabase } from './client';

const { db, sqlite } = createDatabase(env.databasePath);

migrate(db, { migrationsFolder: path.resolve(__dirname, 'migrations') });

logger.info(`Migrations applied to ${env.databasePath}`);
sqlite.close();
