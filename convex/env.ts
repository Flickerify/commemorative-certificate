import { z } from 'zod';

const envSchema = z.object({
  // WorkOS
  WORKOS_API_KEY: z.string(),
  WORKOS_CLIENT_ID: z.string(),
  WORKOS_COOKIE_PASSWORD: z.string(),
  WORKOS_WEBHOOK_USERS_SECRET: z.string(),
  WORKOS_WEBHOOK_ORGANIZATIONS_SECRET: z.string(),
  WORKOS_WEBHOOK_MEMBERSHIPS_SECRET: z.string(),
  WORKOS_ACTION_SECRET: z.string(),
  // Stripe (optional in development)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
  STRIPE_PRICE_ENTERPRISE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ENTERPRISE_YEARLY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
