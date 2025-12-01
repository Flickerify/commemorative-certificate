'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  IconClock,
  IconCheck,
  IconX,
  IconLoader2,
  IconEye,
  IconWebhook,
  IconChevronDown,
  IconChevronRight,
  IconUser,
  IconBuilding,
  IconRefresh,
  IconAlertTriangle,
  IconTrash,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { toast } from 'sonner';

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

function formatDate(timestamp: number | undefined): string {
  if (timestamp === undefined) return '—';
  return new Date(timestamp).toLocaleString();
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

type WebhookEvent =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'organization.created'
  | 'organization.updated'
  | 'organization.deleted'
  | 'organization_domain.verified'
  | 'organization_domain.verification_failed';

type WorkflowStatus = {
  type: string;
  startedAt?: number;
  completedAt?: number;
  returnValue?: unknown;
  error?: string;
};

type SyncRecord = {
  _id: string;
  _creationTime: number;
  entityType: 'user' | 'organization';
  entityId: string;
  targetSystem: 'planetscale';
  status: 'pending' | 'success' | 'failed';
  webhookEvent: WebhookEvent;
  workflowId: string;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
  workflowStatus?: WorkflowStatus | null;
};

type EntityGroup = {
  entityType: 'user' | 'organization';
  entityId: string;
  totalSyncs: number;
  latestSync: SyncRecord;
  successCount: number;
  failedCount: number;
  pendingCount: number;
};

function StatusBadge({ status }: { status: 'pending' | 'success' | 'failed' }) {
  const variants = {
    pending: { variant: 'secondary' as const, icon: IconLoader2, className: 'animate-spin' },
    success: { variant: 'default' as const, icon: IconCheck, className: '' },
    failed: { variant: 'destructive' as const, icon: IconX, className: '' },
  };

  const { variant, icon: Icon, className } = variants[status];

  return (
    <Badge variant={variant} className="gap-1">
      <Icon className={`size-3 ${className}`} />
      {status}
    </Badge>
  );
}

function WebhookEventBadge({ event }: { event: WebhookEvent }) {
  const isCreated = event.endsWith('.created');
  const isDeleted = event.endsWith('.deleted');

  const variant = isDeleted ? 'destructive' : isCreated ? 'default' : 'secondary';

  return (
    <Badge variant={variant} className="gap-1 font-mono text-xs">
      <IconWebhook className="size-3" />
      {event}
    </Badge>
  );
}

function WorkflowStatusBadge({ type }: { type: string }) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    inProgress: { variant: 'secondary', label: 'In Progress' },
    completed: { variant: 'default', label: 'Completed' },
    failed: { variant: 'destructive', label: 'Failed' },
    canceled: { variant: 'outline', label: 'Canceled' },
  };

  const { variant, label } = variants[type] || { variant: 'outline' as const, label: type };

  return <Badge variant={variant}>{label}</Badge>;
}

function EntityIcon({ type }: { type: 'user' | 'organization' }) {
  return type === 'user' ? <IconUser className="size-4" /> : <IconBuilding className="size-4" />;
}

function SyncDetailsDialog({ sync }: { sync: SyncRecord }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <IconEye className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sync Details</DialogTitle>
          <DialogDescription>
            {sync.entityType} • {sync.entityId}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <StatusBadge status={sync.status} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Webhook Event</p>
              <WebhookEventBadge event={sync.webhookEvent} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Duration</p>
              <p className="flex items-center gap-1 text-sm">
                <IconClock className="size-4" />
                {formatDuration(sync.durationMs)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Entity Type</p>
              <Badge variant="outline" className="gap-1">
                <EntityIcon type={sync.entityType} />
                {sync.entityType}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Started</p>
              <p className="text-sm">{formatDate(sync.startedAt)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Completed</p>
              <p className="text-sm">{formatDate(sync.completedAt)}</p>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <h4 className="mb-2 font-medium">Workflow Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Workflow ID</p>
                <code className="text-xs">{sync.workflowId}</code>
              </div>
              {sync.workflowStatus && (
                <div>
                  <p className="text-muted-foreground">Workflow Status</p>
                  <WorkflowStatusBadge type={sync.workflowStatus.type} />
                </div>
              )}
            </div>
          </div>

          {sync.error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <h4 className="mb-2 font-medium text-destructive">Error</h4>
              <pre className="whitespace-pre-wrap text-sm text-destructive">{sync.error}</pre>
            </div>
          )}

          {sync.workflowStatus?.error && sync.workflowStatus.error !== sync.error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <h4 className="mb-2 font-medium text-destructive">Workflow Error</h4>
              <pre className="whitespace-pre-wrap text-sm text-destructive">{sync.workflowStatus.error}</pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SyncHistoryItem({ sync }: { sync: SyncRecord }) {
  return (
    <div className="group flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50">
      <div className="flex flex-1 flex-wrap items-center gap-3">
        <WebhookEventBadge event={sync.webhookEvent} />
        <StatusBadge status={sync.status} />
        {sync.workflowStatus && <WorkflowStatusBadge type={sync.workflowStatus.type} />}
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <IconClock className="size-3.5" />
          {formatDuration(sync.durationMs)}
        </span>
        <span className="w-16 text-right">{formatRelativeTime(sync._creationTime)}</span>
        <SyncDetailsDialog sync={sync} />
      </div>
    </div>
  );
}

function EntityCard({ group }: { group: EntityGroup }) {
  const [isOpen, setIsOpen] = useState(false);
  const history = useQuery(
    api.sync.query.getEntityHistory,
    isOpen ? { entityType: group.entityType, entityId: group.entityId, limit: 50 } : 'skip',
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border bg-card">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              {isOpen ? (
                <IconChevronDown className="size-4 shrink-0" />
              ) : (
                <IconChevronRight className="size-4 shrink-0" />
              )}
              <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                <EntityIcon type={group.entityType} />
              </div>
              <div>
                <p className="font-mono text-sm font-medium">{group.entityId}</p>
                <p className="text-xs text-muted-foreground capitalize">{group.entityType}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="font-mono text-xs">
                  {group.totalSyncs}
                </Badge>
                {group.successCount > 0 && (
                  <Badge variant="default" className="size-6 justify-center p-0">
                    {group.successCount}
                  </Badge>
                )}
                {group.failedCount > 0 && (
                  <Badge variant="destructive" className="size-6 justify-center p-0">
                    {group.failedCount}
                  </Badge>
                )}
                {group.pendingCount > 0 && (
                  <Badge variant="secondary" className="size-6 justify-center p-0">
                    {group.pendingCount}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(group.latestSync._creationTime)}
              </span>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t bg-muted/30 p-4">
            {history === undefined ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((sync) => (
                  <SyncHistoryItem key={sync._id} sync={sync} />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function StatsCards() {
  const stats = useQuery(api.sync.query.getSyncStats, {});

  if (stats === undefined) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    { title: 'Total Syncs', value: stats.total, color: '' },
    { title: 'Entities', value: stats.uniqueEntities, color: '' },
    { title: 'Pending', value: stats.pending, color: 'text-yellow-500' },
    { title: 'Success', value: stats.success, color: 'text-green-500' },
    { title: 'Failed', value: stats.failed, color: 'text-red-500' },
    { title: 'Dead Letter', value: stats.deadLetterCount, color: stats.deadLetterCount > 0 ? 'text-orange-500' : '' },
    { title: 'Avg Duration', value: formatDuration(stats.avgDurationMs), color: '' },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardDescription>{card.title}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GroupedSyncSection() {
  const groups = useQuery(api.sync.query.getSyncsGroupedByEntity, { limit: 100 });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Sync History by Entity</h2>
        <p className="text-sm text-muted-foreground">Click on an entity to expand and see sync history</p>
      </div>
      {groups === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">No sync activity</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <EntityCard key={`${group.entityType}:${group.entityId}`} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// DEAD LETTER QUEUE SECTION
// ============================================================

type DeadLetterItem = {
  _id: Id<'deadLetterQueue'>;
  _creationTime: number;
  workflowId: string;
  entityType: 'user' | 'organization' | 'subscription';
  entityId: string;
  error: string;
  retryable: boolean;
  retryCount: number;
  lastRetryAt?: number;
  resolvedAt?: number;
};

function DeadLetterItemRow({
  item,
  onRetry,
  onResolve,
  isRetrying,
}: {
  item: DeadLetterItem;
  onRetry: (id: Id<'deadLetterQueue'>) => void;
  onResolve: (id: Id<'deadLetterQueue'>) => void;
  isRetrying: boolean;
}) {
  return (
    <TableRow className={item.resolvedAt ? 'opacity-50' : ''}>
      <TableCell>
        <div className="flex items-center gap-2">
          <EntityIcon type={item.entityType === 'subscription' ? 'organization' : item.entityType} />
          <div>
            <span className="font-mono text-xs">{item.entityId.slice(0, 16)}…</span>
            <p className="text-xs text-muted-foreground capitalize">{item.entityType}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{item.workflowId.slice(0, 12)}…</code>
      </TableCell>
      <TableCell>
        <div className="max-w-xs truncate text-sm text-destructive" title={item.error}>
          {item.error}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{item.retryCount}</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatRelativeTime(item._creationTime)}</TableCell>
      <TableCell>
        {item.resolvedAt ? (
          <Badge variant="secondary">Resolved</Badge>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRetry(item._id)}
              disabled={isRetrying || !item.retryable}
            >
              {isRetrying ? <IconLoader2 className="size-4 animate-spin" /> : <IconRefresh className="size-4" />}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <IconCheck className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Mark as Resolved?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark the item as resolved without retrying. Use this if you&apos;ve fixed the issue
                    manually or the sync is no longer needed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onResolve(item._id)}>Mark Resolved</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function DeadLetterQueueSection() {
  const items = useQuery(api.sync.query.getDeadLetterQueue, { limit: 50 });
  const retryItem = useMutation(api.sync.mutation.retryDeadLetterItem);
  const retryAll = useMutation(api.sync.mutation.retryAllDeadLetterItems);
  const resolveItem = useMutation(api.sync.mutation.resolveDeadLetterItem);

  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [isRetryingAll, setIsRetryingAll] = useState(false);

  const handleRetry = async (itemId: Id<'deadLetterQueue'>) => {
    setRetryingIds((prev) => new Set([...prev, itemId]));
    try {
      const result = await retryItem({ itemId });
      if (result.success) {
        toast.success('Retry initiated', {
          description: `New workflow started: ${result.newWorkflowId?.slice(0, 12)}…`,
        });
      } else {
        toast.error('Retry failed', { description: result.error });
      }
    } catch (error) {
      toast.error('Retry failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleResolve = async (itemId: Id<'deadLetterQueue'>) => {
    try {
      const result = await resolveItem({ itemId });
      if (result.success) {
        toast.success('Item marked as resolved');
      } else {
        toast.error('Failed to resolve', { description: result.error });
      }
    } catch (error) {
      toast.error('Failed to resolve', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleRetryAll = async () => {
    setIsRetryingAll(true);
    try {
      const result = await retryAll({});
      toast.success('Bulk retry complete', {
        description: `${result.succeeded}/${result.total} succeeded`,
      });
      if (result.errors.length > 0) {
        console.error('Retry errors:', result.errors);
      }
    } catch (error) {
      toast.error('Bulk retry failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsRetryingAll(false);
    }
  };

  const unresolvedCount = items?.filter((item) => !item.resolvedAt).length ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <IconAlertTriangle className="size-5 text-orange-500" />
              Dead Letter Queue
            </CardTitle>
            <CardDescription>Failed sync operations that need attention</CardDescription>
          </div>
          {unresolvedCount > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={isRetryingAll}>
                  {isRetryingAll ? (
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <IconPlayerPlay className="mr-2 size-4" />
                  )}
                  Retry All ({unresolvedCount})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Retry all failed items?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will attempt to retry all {unresolvedCount} unresolved items in the dead letter queue. Each
                    item will be processed sequentially.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRetryAll}>Retry All</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <IconCheck className="mb-2 size-8 text-green-500" />
            <p>No items in dead letter queue</p>
            <p className="text-sm">All syncs are processing normally</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Workflow ID</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <DeadLetterItemRow
                  key={item._id}
                  item={item as DeadLetterItem}
                  onRetry={handleRetry}
                  onResolve={handleResolve}
                  isRetrying={retryingIds.has(item._id)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// RECENT SYNCS TABLE
// ============================================================

function RecentSyncsTable() {
  const syncs = useQuery(api.sync.query.getSyncsWithWorkflowStatus, { limit: 20 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Syncs</CardTitle>
        <CardDescription>Latest synchronization events (flat view)</CardDescription>
      </CardHeader>
      <CardContent>
        {syncs === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : syncs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No sync activity</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Webhook Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Started</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {syncs.map((sync) => (
                <TableRow key={sync._id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EntityIcon type={sync.entityType} />
                      <span className="font-mono text-xs">{sync.entityId.slice(0, 12)}…</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <WebhookEventBadge event={sync.webhookEvent} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={sync.status} />
                  </TableCell>
                  <TableCell>
                    {sync.workflowStatus ? (
                      <WorkflowStatusBadge type={sync.workflowStatus.type} />
                    ) : (
                      <Badge variant="outline">Unknown</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm">
                      <IconClock className="size-3 text-muted-foreground" />
                      {formatDuration(sync.durationMs)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRelativeTime(sync._creationTime)}
                  </TableCell>
                  <TableCell>
                    <SyncDetailsDialog sync={sync} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function SyncStatusPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sync Status</h1>
        <p className="text-muted-foreground">Monitor WorkOS to PlanetScale synchronization workflows</p>
      </div>

      <StatsCards />

      <DeadLetterQueueSection />

      <GroupedSyncSection />

      <RecentSyncsTable />
    </div>
  );
}
