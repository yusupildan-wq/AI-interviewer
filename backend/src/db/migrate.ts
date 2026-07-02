import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

import { env } from '../config/env.js';

if (!env.databaseUrl) {
  throw new Error('DATABASE_URL is not configured. Set it in backend/.env.');
}

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

const pool = new Pool({ connectionString: env.databaseUrl });
const db = drizzle(pool);

await migrate(db, { migrationsFolder });
await pool.end();

console.log('Migrations applied.');
