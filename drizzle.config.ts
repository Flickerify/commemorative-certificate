import { defineConfig } from 'drizzle-kit';
import { env } from './env';

export default defineConfig({
  out: './drizzle',
  schema: './db/schema',
  dialect: 'mysql',
  dbCredentials: {
    host: env.DATABASE_HOST,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
  },
});
