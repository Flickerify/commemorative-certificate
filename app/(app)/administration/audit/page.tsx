'use client';

import { useState, createElement, useEffect } from 'react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useQuery, usePaginatedQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { PageShell } from '@/components/dashboard/page-shell';
import { PermissionPageGuard } from '@/components/rbac';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import {
  Activity,
  ArrowRight,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  Download,
  Filter,
  Globe,
  Key,
  Loader2,
  Search,
  Settings,
  Shield,
  User,
  Users,
  X,
  Zap,
  Database,
  Webhook,
  Crown,
  ChevronsUpDown,
} from 'lucide-react';
import type { AuditCategory, AuditAction, AuditStatus } from '@/convex/schema';
import type { Id } from '@/convex/_generated/dataModel';

// Page size options
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

// Category icons and colors
const categoryConfig: Record<
  AuditCategory,
  { icon: React.ElementType; label: string; color: string; bgColor: string }
> = {
  authentication: {
    icon: Key,
    label: 'Authentication',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  member: {
    icon: Users,
    label: 'Members',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-500/10',
  },
  billing: {
    icon: CreditCard,
    label: 'Billing',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  settings: {
    icon: Settings,
    label: 'Settings',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  security: {
    icon: Shield,
    label: 'Security',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10',
  },
  data: {
    icon: Database,
    label: 'Data',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-500/10',
  },
  integration: {
    icon: Webhook,
    label: 'Integrations',
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-500/10',
  },
};

// Status config
const statusConfig: Record<AuditStatus, { label: string; className: string }> = {
  success: {
    label: 'Success',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  failure: {
    label: 'Failed',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
  pending: {
    label: 'Pending',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
};

// Get action icon based on action string
function getActionIcon(action: AuditAction): React.ElementType {
  const [actionPrefix, actionSuffix] = action.split('.') as [string, string | undefined];

  if (actionPrefix === 'authentication') {
    return Key;
  }

  if (actionPrefix === 'member') {
    if (actionSuffix?.includes('invited') || actionSuffix?.includes('joined')) return Users;
    if (actionSuffix?.includes('removed') || actionSuffix?.includes('left')) return Users;
    if (actionSuffix?.includes('role')) return Users;
    return Users;
  }

  if (actionPrefix === 'billing') {
    if (actionSuffix?.includes('upgrade')) return ArrowRight;
    if (actionSuffix?.includes('downgrade')) return ArrowRight;
    return CreditCard;
  }

  if (actionPrefix === 'security') {
    if (actionSuffix?.includes('api_key')) return Key;
    if (actionSuffix?.includes('sso')) return Globe;
    return Shield;
  }

  if (actionPrefix === 'settings') {
    if (actionSuffix?.includes('domain')) return Globe;
    return Settings;
  }

  if (actionPrefix === 'data') {
    return Database;
  }

  if (actionPrefix === 'integration') {
    return Webhook;
  }

  return Activity;
}

// Format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: timestamp < now - 365 * 24 * 60 * 60 * 1000 ? 'numeric' : undefined,
  });
}

// Format action for display
function formatAction(action: AuditAction): string {
  return action
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// Format date for display
function formatDate(date: Date | undefined): string {
  if (!date) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Audit log detail modal
interface AuditDetailProps {
  log: NonNullable<typeof api.audit.query.getAuditLog._returnType> | null;
  isOpen: boolean;
  onClose: () => void;
}

function AuditDetailModal({ log, isOpen, onClose }: AuditDetailProps) {
  if (!log) return null;

  const categoryInfo = categoryConfig[log.category];
  const statusInfo = statusConfig[log.status];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={cn('rounded-lg p-2', categoryInfo.bgColor)}>
              {createElement(getActionIcon(log.action), { className: cn('h-5 w-5', categoryInfo.color) })}
            </div>
            <span>{formatAction(log.action)}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Description */}
          <p className="text-sm text-muted-foreground">{log.description}</p>

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
            <Badge variant="outline">
              <categoryInfo.icon className="h-3 w-3 mr-1" />
              {categoryInfo.label}
            </Badge>
            <span className="text-xs text-muted-foreground ml-auto">{new Date(log.timestamp).toLocaleString()}</span>
          </div>

          {/* Details list */}
          <div className="rounded-lg border divide-y text-sm">
            {/* Actor */}
            <div className="p-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                {log.actorType === 'user' && <User className="h-4 w-4" />}
                {log.actorType === 'system' && <Zap className="h-4 w-4" />}
                {log.actorType === 'api' && <Key className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{log.actorName || log.actorEmail || 'System'}</div>
                {log.actorEmail && log.actorName && (
                  <div className="text-muted-foreground text-xs">{log.actorEmail}</div>
                )}
              </div>
              <Badge variant="secondary" className="capitalize shrink-0">
                {log.actorType}
              </Badge>
            </div>

            {/* Target */}
            {(log.targetType || log.targetId || log.targetName) && (
              <div className="p-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Target</div>
                {log.targetType && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium capitalize">{log.targetType}</span>
                  </div>
                )}
                {log.targetName && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">Name</span>
                    <span className="font-medium text-right break-all">{log.targetName}</span>
                  </div>
                )}
                {log.targetId && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">ID</span>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">{log.targetId}</code>
                  </div>
                )}
              </div>
            )}

            {/* Request Context */}
            {(log.ipAddress || log.userAgent) && (
              <div className="p-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Context</div>
                {log.ipAddress && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IP</span>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{log.ipAddress}</code>
                  </div>
                )}
                {log.userAgent && (
                  <div>
                    <span className="text-muted-foreground block mb-1">User Agent</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded block break-all">{log.userAgent}</code>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Metadata */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Details</div>
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto max-h-32">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* Footer */}
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            Expires {new Date(log.expiresAt).toLocaleDateString('en-US', { dateStyle: 'long' })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Actor Combobox Component
interface ActorComboboxProps {
  organizationId: string;
  value: Id<'users'> | undefined;
  onChange: (value: Id<'users'> | undefined) => void;
}

function ActorCombobox({ organizationId, value, onChange }: ActorComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search with 2+ character requirement
  useEffect(() => {
    const shouldSearch = searchQuery === '' || searchQuery.length >= 2;
    const newValue = shouldSearch ? searchQuery : '';

    const timer = setTimeout(
      () => {
        setDebouncedSearch(newValue);
      },
      searchQuery === '' ? 0 : 300,
    );

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const members = useQuery(
    api.audit.query.searchOrganizationMembers,
    organizationId ? { organizationId, searchQuery: debouncedSearch || undefined, limit: 10 } : 'skip',
  );

  const selectedMember = members?.find((m) => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-[180px] justify-between">
          {selectedMember ? (
            <span className="truncate">{selectedMember.name}</span>
          ) : (
            <span className="text-muted-foreground">All actors</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search members..." value={searchQuery} onValueChange={setSearchQuery} />
          <CommandList>
            <CommandEmpty>No members found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                <span>All actors</span>
              </CommandItem>
              {members?.map((member) => (
                <CommandItem
                  key={member.id}
                  onSelect={() => {
                    onChange(member.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === member.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{member.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{member.email}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Date Range Picker Component
interface DateRangePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
}

function DateRangePicker({ startDate, endDate, onStartDateChange, onEndDateChange }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn('w-[140px] justify-start text-left font-normal', !startDate && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {startDate ? formatDate(startDate) : 'Start date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={startDate}
            onSelect={onStartDateChange}
            disabled={(date) => (endDate ? date > endDate : false) || date > new Date()}
          />
        </PopoverContent>
      </Popover>
      <span className="text-muted-foreground">→</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn('w-[140px] justify-start text-left font-normal', !endDate && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {endDate ? formatDate(endDate) : 'End date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={endDate}
            onSelect={onEndDateChange}
            disabled={(date) => (startDate ? date < startDate : false) || date > new Date()}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function AuditPage() {
  // Protect page with permission guard
  return (
    <PermissionPageGuard
      permission="audit:logs:read-only"
      redirectTo="/administration/billing"
      deniedMessage="You don't have permission to view audit logs. This feature requires the audit:logs:read-only permission."
    >
      <AuditPageContent />
    </PermissionPageGuard>
  );
}

function AuditPageContent() {
  const { organizationId } = useAuth();
  const [activeTab, setActiveTab] = useState('logs');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AuditStatus | 'all'>('all');
  const [actorFilter, setActorFilter] = useState<Id<'users'> | undefined>(undefined);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  // Pagination
  const [pageSize, setPageSize] = useState<PageSize>(25);

  // Detail modal
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Debounce search query with proper cleanup
  // Only triggers search if input is empty OR has 2+ characters
  useEffect(() => {
    // Determine the debounced value based on input length
    const shouldSearch = searchQuery === '' || searchQuery.length >= 2;
    const newDebouncedValue = shouldSearch ? searchQuery : '';

    // Use timeout for all cases to avoid sync setState in effect
    const timer = setTimeout(
      () => {
        setDebouncedSearch(newDebouncedValue);
      },
      searchQuery === '' ? 0 : 400,
    ); // Immediate for clear, 400ms for search

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Fetch audit overview
  const auditOverview = useQuery(api.audit.query.getAuditOverview, organizationId ? { organizationId } : 'skip');

  // Use usePaginatedQuery for proper Convex pagination
  const {
    results: logs,
    status: paginationStatus,
    loadMore,
    isLoading: isLoadingLogs,
  } = usePaginatedQuery(
    api.audit.query.listAuditLogs,
    organizationId && auditOverview?.isEnterprise
      ? {
          organizationId,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          actorId: actorFilter,
          startDate: startDate ? startDate.getTime() : undefined,
          endDate: endDate ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1).getTime() : undefined,
          searchQuery: debouncedSearch || undefined,
        }
      : 'skip',
    { initialNumItems: pageSize },
  );

  // Fetch selected log details
  const selectedLog = useQuery(
    api.audit.query.getAuditLog,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedLogId && organizationId ? { organizationId, auditLogId: selectedLogId as any } : 'skip',
  );

  const isLoading = auditOverview === undefined;
  const isNotEnterprise = auditOverview && !auditOverview.isEnterprise;
  const isEnabled = auditOverview?.isEnabled;

  // Handle log click
  const handleLogClick = (logId: string) => {
    setSelectedLogId(logId);
    setIsDetailOpen(true);
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setActorFilter(undefined);
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const hasActiveFilters =
    debouncedSearch || categoryFilter !== 'all' || statusFilter !== 'all' || actorFilter || startDate || endDate;

  return (
    <>
      <PageShell
        title="Audit Logs"
        description="Track all activity and changes within your organization"
        headerActions={
          isEnabled && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 bg-transparent">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Download className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Download className="h-4 w-4 mr-2" />
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      >
        {isLoading ? (
          <AuditPageSkeleton />
        ) : isNotEnterprise ? (
          <EnterpriseUpgradePrompt />
        ) : !isEnabled ? (
          <AuditNotEnabledPrompt />
        ) : (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Overview Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard
                title="Total Events"
                value={auditOverview?.stats?.totalLogs ?? 0}
                icon={Activity}
                description="All time"
              />
              <StatCard title="Last 24 Hours" value={auditOverview?.stats?.logsLast24h ?? 0} icon={Clock} />
              <StatCard title="Last 7 Days" value={auditOverview?.stats?.logsLast7d ?? 0} icon={CalendarIcon} />
              <StatCard
                title="Retention"
                value={`${auditOverview?.settings?.retentionDays ?? 365} days`}
                icon={Shield}
                description="1 year included"
              />
            </div>

            {/* Category Breakdown */}
            {auditOverview?.stats?.categoryBreakdown && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Activity by Category (Last 30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(categoryConfig).map(([category, config]) => {
                      const count = auditOverview.stats?.categoryBreakdown[category as AuditCategory] ?? 0;
                      const Icon = config.icon;
                      return (
                        <button
                          key={category}
                          onClick={() =>
                            setCategoryFilter(categoryFilter === category ? 'all' : (category as AuditCategory))
                          }
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
                            categoryFilter === category ? 'bg-primary/10 border-primary' : 'hover:bg-muted',
                          )}
                        >
                          <div className={cn('rounded p-1', config.bgColor)}>
                            <Icon className={cn('h-4 w-4', config.color)} />
                          </div>
                          <span className="text-sm font-medium">{config.label}</span>
                          <Badge variant="secondary" className="text-xs">
                            {count}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Logs Section */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="logs" className="gap-2">
                    <Activity className="h-4 w-4" />
                    Event Log
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </TabsTrigger>
                </TabsList>

                {activeTab === 'logs' && (
                  <div className="flex items-center gap-2">
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-4 w-4 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <TabsContent value="logs" className="space-y-4 mt-4">
                {/* Filters Row 1: Search and Quick Filters */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search descriptions (min 2 chars)…"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        className="pl-9"
                      />
                      {searchQuery.length > 0 && searchQuery.length < 2 && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          Type {2 - searchQuery.length} more
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Select
                        value={categoryFilter}
                        onValueChange={(v) => setCategoryFilter(v as AuditCategory | 'all')}
                      >
                        <SelectTrigger className="w-[150px]">
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {Object.entries(categoryConfig).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              {config.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AuditStatus | 'all')}>
                        <SelectTrigger className="w-[130px]">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="success">Success</SelectItem>
                          <SelectItem value="failure">Failed</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Filters Row 2: Actor, Dates, Page Size */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
                    {organizationId && (
                      <ActorCombobox organizationId={organizationId} value={actorFilter} onChange={setActorFilter} />
                    )}
                    <DateRangePicker
                      startDate={startDate}
                      endDate={endDate}
                      onStartDateChange={setStartDate}
                      onEndDateChange={setEndDate}
                    />
                    <div className="flex items-center gap-2 sm:ml-auto">
                      <span className="text-sm text-muted-foreground">Show</span>
                      <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v) as PageSize)}>
                        <SelectTrigger className="w-[80px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map((size) => (
                            <SelectItem key={size} value={String(size)}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground">per page</span>
                    </div>
                  </div>
                </div>

                {/* Event List */}
                {paginationStatus === 'LoadingFirstPage' || isLoadingLogs ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : logs.length === 0 ? (
                  <Empty className="border rounded-xl py-16">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Activity />
                      </EmptyMedia>
                      <EmptyTitle>No audit events found</EmptyTitle>
                      <EmptyDescription>
                        {hasActiveFilters
                          ? 'Try adjusting your filters to find what you are looking for.'
                          : 'Activity will appear here as members use your organization.'}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log) => {
                      const config = log.category ? categoryConfig[log.category] : null;
                      const status = log.status ? statusConfig[log.status] : null;
                      const Icon = log.action ? getActionIcon(log.action) : Activity;

                      return (
                        <button
                          key={log._id}
                          onClick={() => handleLogClick(log._id)}
                          className="w-full text-left p-4 rounded-lg border hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-start gap-4">
                            <div className={cn('rounded-lg p-2 shrink-0', config?.bgColor ?? 'bg-muted')}>
                              {createElement(Icon, { className: cn('h-4 w-4', config?.color ?? 'text-foreground') })}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">
                                  {log.action ? formatAction(log.action) : 'Unknown Action'}
                                </span>
                                {status && (
                                  <Badge variant="outline" className={cn('text-xs', status.className)}>
                                    {status.label}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{log.description}</p>
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <span>{log.actorName || log.actorEmail || 'System'}</span>
                                <span>•</span>
                                <span>{formatRelativeTime(log.timestamp)}</span>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                        </button>
                      );
                    })}

                    {/* Pagination */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Showing {logs.length} event{logs.length !== 1 ? 's' : ''}
                        {paginationStatus !== 'Exhausted' && ' (more available)'}
                      </p>
                      <PaginationButton status={paginationStatus} onLoadMore={() => loadMore(pageSize)} />
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="settings" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Audit Settings</CardTitle>
                    <CardDescription>Configure audit log retention and export options</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Retention Period */}
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                          <Clock className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium">Retention Period</h4>
                          <p className="text-sm text-muted-foreground">
                            Audit logs are retained for {auditOverview?.settings?.retentionDays ?? 365} days
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-muted">
                          {auditOverview?.settings?.retentionDays ?? 365} days
                        </Badge>
                        <Button variant="outline" size="sm" disabled>
                          Upgrade
                        </Button>
                      </div>
                    </div>

                    {/* Retention Upgrade Notice */}
                    <div className="rounded-lg border border-dashed p-4 bg-muted/30">
                      <div className="flex items-start gap-3">
                        <Crown className="h-5 w-5 text-amber-500 mt-0.5" />
                        <div>
                          <h4 className="font-medium">Extended Retention</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Need longer retention? Extended retention periods will be available in a future update.
                            Contact us for custom retention requirements.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Data Range */}
                    {auditOverview?.stats?.oldestLog && auditOverview?.stats?.newestLog && (
                      <div className="p-4 rounded-lg bg-muted/30">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Current Data Range</h4>
                        <div className="flex items-center gap-2 text-sm">
                          <CalendarIcon className="h-4 w-4" />
                          <span>
                            {new Date(auditOverview.stats.oldestLog).toLocaleDateString('en-US', {
                              dateStyle: 'medium',
                            })}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {new Date(auditOverview.stats.newestLog).toLocaleDateString('en-US', {
                              dateStyle: 'medium',
                            })}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </PageShell>

      {/* Detail Modal */}
      <AuditDetailModal
        log={selectedLog ?? null}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedLogId(null);
        }}
      />
    </>
  );
}

// Pagination Button Component
function PaginationButton({
  status,
  onLoadMore,
}: {
  status: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted';
  onLoadMore: () => void;
}) {
  if (status === 'CanLoadMore') {
    return (
      <Button variant="outline" size="sm" onClick={onLoadMore}>
        Load More
      </Button>
    );
  }
  if (status === 'LoadingMore') {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading…
      </Button>
    );
  }
  return null;
}

// Stat Card Component
interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  description?: string;
}

function StatCard({ title, value, icon: Icon, description }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className="rounded-lg bg-muted p-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Enterprise Upgrade Prompt
function EnterpriseUpgradePrompt() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="mb-6 rounded-full bg-linear-to-br from-violet-500/20 to-purple-500/20 p-6">
        <Crown className="h-12 w-12 text-violet-500" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Audit Logs for Enterprise</h2>
      <p className="text-muted-foreground max-w-md mb-6">
        Comprehensive audit logging is available on the Enterprise plan. Track all member actions, security events, and
        changes within your organization.
      </p>
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        <FeatureItem icon={Activity} text="Complete activity tracking" />
        <FeatureItem icon={Shield} text="Security event monitoring" />
        <FeatureItem icon={Clock} text="1-year retention included" />
        <FeatureItem icon={Download} text="Export to CSV/JSON" />
      </div>
      <Button size="lg" className="gap-2" asChild>
        <a href="/settings/billing">
          <Crown className="h-4 w-4" />
          Upgrade to Enterprise
        </a>
      </Button>
    </div>
  );
}

// Audit Not Enabled Prompt
function AuditNotEnabledPrompt() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="mb-6 rounded-full bg-muted p-6">
        <Activity className="h-12 w-12 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Audit Logging Not Available</h2>
      <p className="text-muted-foreground max-w-md">
        Audit logging is not currently enabled for your organization. Contact support for assistance.
      </p>
    </div>
  );
}

// Feature Item
function FeatureItem({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span>{text}</span>
    </div>
  );
}

// Skeleton loader
function AuditPageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-28" />
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
