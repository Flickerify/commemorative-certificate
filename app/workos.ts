import { env } from '@/convex/env';
import { WorkOS } from '@workos-inc/node';

export const workos = new WorkOS(env.WORKOS_API_KEY, {
  clientId: env.WORKOS_CLIENT_ID,
});
