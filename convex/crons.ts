import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// ============================================================
// WORKOS EVENTS API POLLING (SAFEGUARD)
// ============================================================

// Poll WorkOS Events API every 60 seconds as a SAFEGUARD for missed webhooks
// Webhooks are the primary method (instant), Events API catches any that fail
// Both share the same event ID for deduplication via workosProcessedEvents table
crons.interval('poll-workos-events', { seconds: 60 }, internal.workos.events.action.pollEvents, {});

// Clean up old processed events once a day (keep last 30 days)
// This prevents unbounded growth of the idempotency table
crons.interval(
  'cleanup-workos-processed-events',
  { hours: 24 },
  internal.workos.events.mutation.cleanupOldProcessedEvents,
  {},
);

// ============================================================
// AUDIT LOG CLEANUP
// ============================================================

// Run audit log cleanup daily to remove expired logs based on organization TTL settings.
// The cleanup mutation handles batching to avoid timeouts with large datasets.
crons.interval('cleanup-expired-audit-logs', { hours: 24 }, internal.audit.internal.mutation.cleanupExpiredAuditLogs, {
  batchSize: 500,
});

export default crons;
