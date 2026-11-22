import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_PATH: z.string().default('./data/stocktake.sqlite'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  /** Time zone used for dates in exported reports. */
  STORE_TIMEZONE: z.string().default('America/Puerto_Rico'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error(
    'Invalid environment configuration. Copy .env.example to server/.env and check the values.',
  );
}

const data = parsed.data;

export const env = {
  port: data.PORT,
  nodeEnv: data.NODE_ENV,
  logLevel: data.LOG_LEVEL,
  storeTimeZone: data.STORE_TIMEZONE,
  /** Absolute path to the SQLite database file, resolved relative to the server package root. */
  databasePath: path.resolve(__dirname, '..', '..', data.DATABASE_PATH),
  /** Origins allowed to call the API / open a WebSocket connection (e.g. your phone's LAN URL). */
  clientOrigins: data.CLIENT_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
