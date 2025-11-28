import { z } from 'zod';

const envSchema = z.object({
  WORKOS_API_KEY: z.string(),
  WORKOS_CLIENT_ID: z.string(),
  WORKOS_COOKIE_PASSWORD: z.string(),
  WORKOS_WEBHOOK_USERS_SECRET: z.string(),
  WORKOS_WEBHOOK_ORGANIZATIONS_SECRET: z.string(),
  WORKOS_WEBHOOK_MEMBERSHIPS_SECRET: z.string(),
});

export const env = envSchema.parse(process.env);
