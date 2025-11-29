import { env } from '../env';
import ws from 'ws';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

neonConfig.webSocketConstructor = ws;
// These MUST be set for PlanetScale Postgres connections
neonConfig.pipelineConnect = false;
neonConfig.wsProxy = (host, port) => `${host}/v2?address=${host}:${port}`;

const pool = new Pool({ connectionString: env.DATABASE_URL });
const db = drizzle({ client: pool });

export default db;
