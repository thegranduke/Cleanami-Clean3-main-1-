import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required.');
}

config({ path: '.env.local' }); // or .env.local

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle({ client, schema });

export type Database = typeof db;
export { schema };