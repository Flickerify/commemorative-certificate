import { env } from '@/env';
import { drizzle } from 'drizzle-orm/mysql2';

export const db = drizzle({
  connection: {
    host: env.DATABASE_HOST,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
  },
});
