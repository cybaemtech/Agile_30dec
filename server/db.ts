import dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';
import * as schema from '@shared/schema';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('No DATABASE_URL found. Database operations will not be available.');
  console.warn('Note: The application will run with limited functionality');
} else {
  console.log('PostgreSQL database connection configured');
}

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (DATABASE_URL) {
  try {
    const sql = neon(DATABASE_URL);
    db = drizzle(sql, { schema });
    console.log('Using PostgreSQL database for data storage');
  } catch (error) {
    console.error('PostgreSQL connection failed:', error);
    console.log('Falling back to in-memory storage');
  }
} else {
  console.log('Using in-memory storage (data will not persist between restarts)');
}

export { db };