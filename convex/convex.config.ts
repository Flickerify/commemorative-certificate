// convex/convex.config.ts
import { defineApp } from 'convex/server';
import rateLimiter from '@convex-dev/rate-limiter/convex.config';
import workflow from '@convex-dev/workflow/convex.config';
import r2 from '@convex-dev/r2/convex.config';

const app = defineApp();
app.use(rateLimiter);
app.use(workflow);
app.use(r2);
export default app;
