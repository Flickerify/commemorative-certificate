'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
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
} from '@tabler/icons-react';

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
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
    { title: 'Avg Duration', value: formatDuration(stats.avgDurationMs), color: '' },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
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

      <GroupedSyncSection />

      <RecentSyncsTable />
    </div>
  );
}
