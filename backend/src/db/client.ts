import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { env } from '../config/env.js';
import * as schema from './schema.js';

if (!env.databaseUrl) {
  throw new Error(
    'DATABASE_URL is not configured. Set it in backend/.env (see backend/.env.example) and ' +
      'ensure Postgres is running.',
  );
}

const pool = new Pool({ connectionString: env.databaseUrl });

export const db = drizzle(pool, { schema });
