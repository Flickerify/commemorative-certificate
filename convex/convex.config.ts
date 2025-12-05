// convex/convex.config.ts
import { defineApp } from 'convex/server';
import rateLimiter from '@convex-dev/rate-limiter/convex.config';
import workflow from '@convex-dev/workflow/convex.config';
import r2 from '@convex-dev/r2/convex.config';
import crons from '@convex-dev/crons/convex.config';
import workpool from '@convex-dev/workpool/convex.config';
import resend from '@convex-dev/resend/convex.config';

const app = defineApp();

app.use(rateLimiter);
app.use(workflow);
app.use(r2);
app.use(crons);
app.use(workpool, { name: 'emailWorkpool' });
app.use(workpool, { name: 'crawlerWorkpool' });
app.use(resend);

export default app;
