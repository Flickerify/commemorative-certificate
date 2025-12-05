'use client';

import { useState } from 'react';
import { useQuery, useAction, usePaginatedQuery } from 'convex/react';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  IconClock,
  IconCheck,
  IconX,
  IconMail,
  IconPhone,
  IconBuilding,
  IconUsers,
  IconCalendar,
  IconCurrencyDollar,
  IconWorld,
  IconBriefcase,
  IconMessageCircle,
  IconChevronRight,
  IconLoader2,
  IconInbox,
  IconUserCheck,
  IconUserX,
  IconTrendingUp,
  IconRefresh,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type InquiryStatus = 'pending' | 'contacted' | 'approved' | 'rejected' | 'converted';

const STATUS_CONFIG: Record<
  InquiryStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }
> = {
  pending: { label: 'Pending', variant: 'secondary', icon: IconClock },
  contacted: { label: 'Contacted', variant: 'outline', icon: IconMessageCircle },
  approved: { label: 'Approved', variant: 'default', icon: IconCheck },
  rejected: { label: 'Rejected', variant: 'destructive', icon: IconX },
  converted: { label: 'Converted', variant: 'default', icon: IconTrendingUp },
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  return 'Just now';
}

// Stats Card Component
function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  description?: string;
  trend?: { value: number; label: string };
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {trend && (
          <p className="text-xs text-muted-foreground">
            <span className={trend.value > 0 ? 'text-emerald-500' : 'text-muted-foreground'}>
              +{trend.value}
            </span>{' '}
            {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Inquiry Detail Dialog
function InquiryDetailDialog({
  inquiry,
  open,
  onOpenChange,
  onStatusUpdate,
}: {
  inquiry: NonNullable<ReturnType<typeof useQuery<typeof api.enterpriseInquiry.query.getById>>>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdate: (status: InquiryStatus, notes?: string) => Promise<void>;
}) {
  const [newStatus, setNewStatus] = useState<InquiryStatus>(inquiry.status);
  const [adminNotes, setAdminNotes] = useState(inquiry.adminNotes || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await onStatusUpdate(newStatus, adminNotes);
      onOpenChange(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const StatusIcon = STATUS_CONFIG[inquiry.status].icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">
                {inquiry.firstName} {inquiry.lastName}
              </DialogTitle>
              <DialogDescription>{inquiry.companyName}</DialogDescription>
            </div>
            <Badge variant={STATUS_CONFIG[inquiry.status].variant}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {STATUS_CONFIG[inquiry.status].label}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="requirements">Requirements</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6 mt-4">
            {/* Contact Information */}
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                Contact Information
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <IconMail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${inquiry.email}`} className="text-sm hover:underline">
                    {inquiry.email}
                  </a>
                </div>
                {inquiry.phone && (
                  <div className="flex items-center gap-2">
                    <IconPhone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${inquiry.phone}`} className="text-sm hover:underline">
                      {inquiry.phone}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <IconBriefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{inquiry.jobTitle}</span>
                </div>
              </div>
            </div>

            {/* Company Information */}
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                Company Information
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <IconBuilding className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{inquiry.companyName}</span>
                </div>
                {inquiry.companyWebsite && (
                  <div className="flex items-center gap-2">
                    <IconWorld className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={inquiry.companyWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline"
                    >
                      {inquiry.companyWebsite}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <IconUsers className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{inquiry.companySize} employees</span>
                </div>
                <div className="flex items-center gap-2">
                  <IconBriefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{inquiry.industry}</span>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                Timeline
              </h4>
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Submitted:</span>{' '}
                  {formatDateTime(inquiry.createdAt)}
                </div>
                {inquiry.respondedAt && (
                  <div>
                    <span className="text-muted-foreground">Responded:</span>{' '}
                    {formatDateTime(inquiry.respondedAt)}
                  </div>
                )}
              </div>
            </div>

            {/* Email Status */}
            <div className="flex gap-4">
              <Badge variant={inquiry.confirmationEmailSent ? 'default' : 'outline'}>
                {inquiry.confirmationEmailSent ? (
                  <IconCheck className="mr-1 h-3 w-3" />
                ) : (
                  <IconX className="mr-1 h-3 w-3" />
                )}
                Confirmation Email
              </Badge>
              <Badge variant={inquiry.adminNotificationSent ? 'default' : 'outline'}>
                {inquiry.adminNotificationSent ? (
                  <IconCheck className="mr-1 h-3 w-3" />
                ) : (
                  <IconX className="mr-1 h-3 w-3" />
                )}
                Admin Notification
              </Badge>
            </div>
          </TabsContent>

          <TabsContent value="requirements" className="space-y-6 mt-4">
            {/* Scale */}
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                Scale &amp; Timeline
              </h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{inquiry.expectedUsers}</div>
                  <div className="text-sm text-muted-foreground">Expected users</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-medium">{inquiry.timeline.replace(/-/g, ' ')}</div>
                  <div className="text-sm text-muted-foreground">Timeline</div>
                </div>
                {inquiry.budget && (
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium">{inquiry.budget}</div>
                    <div className="text-sm text-muted-foreground">Budget</div>
                  </div>
                )}
              </div>
            </div>

            {/* Use Case */}
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                Use Case
              </h4>
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-sm whitespace-pre-wrap">{inquiry.useCase}</p>
              </div>
            </div>

            {/* Current Solution */}
            {inquiry.currentSolution && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                  Current Solution
                </h4>
                <div className="rounded-lg border p-4 bg-muted/30">
                  <p className="text-sm">{inquiry.currentSolution}</p>
                </div>
              </div>
            )}

            {/* Features of Interest */}
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                Features of Interest
              </h4>
              <div className="flex flex-wrap gap-2">
                {inquiry.interestedFeatures.map((feature) => (
                  <Badge key={feature} variant="secondary">
                    {feature.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Additional Requirements */}
            {inquiry.additionalRequirements && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                  Additional Requirements
                </h4>
                <div className="rounded-lg border p-4 bg-muted/30">
                  <p className="text-sm whitespace-pre-wrap">{inquiry.additionalRequirements}</p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="actions" className="space-y-6 mt-4">
            {/* Status Update */}
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                Update Status
              </h4>
              <Select
                value={newStatus}
                onValueChange={(value) => setNewStatus(value as InquiryStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={status} value={status}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Admin Notes */}
            <div>
              <Label htmlFor="adminNotes">Admin Notes</Label>
              <Textarea
                id="adminNotes"
                placeholder="Add internal notes about this inquiry…"
                rows={4}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="mt-2"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <a href={`mailto:${inquiry.email}`}>
                  <IconMail className="mr-2 h-4 w-4" />
                  Send Email
                </a>
              </Button>
              {inquiry.phone && (
                <Button variant="outline" asChild>
                  <a href={`tel:${inquiry.phone}`}>
                    <IconPhone className="mr-2 h-4 w-4" />
                    Call
                  </a>
                </Button>
              )}
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleUpdate} disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Main Page Component
export default function EnterpriseInquiriesPage() {
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | 'all'>('all');
  const [selectedInquiryId, setSelectedInquiryId] = useState<Id<'enterpriseInquiries'> | null>(null);

  const stats = useQuery(api.enterpriseInquiry.query.getStats);
  const {
    results: inquiries,
    status: paginationStatus,
    loadMore,
  } = usePaginatedQuery(
    api.enterpriseInquiry.query.list,
    statusFilter === 'all' ? { status: undefined } : { status: statusFilter },
    { initialNumItems: 20 },
  );

  const selectedInquiry = useQuery(
    api.enterpriseInquiry.query.getById,
    selectedInquiryId ? { inquiryId: selectedInquiryId } : 'skip',
  );

  const updateStatus = useAction(api.enterpriseInquiry.action.updateStatus);

  const handleStatusUpdate = async (status: InquiryStatus, notes?: string) => {
    if (!selectedInquiryId) return;

    try {
      const result = await updateStatus({
        inquiryId: selectedInquiryId,
        status,
        adminNotes: notes,
      });

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Enterprise Inquiries</h1>
              <p className="text-muted-foreground">Manage enterprise contact requests</p>
            </div>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <IconRefresh className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        {stats ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Inquiries"
              value={stats.total}
              icon={IconInbox}
              trend={{ value: stats.thisWeek, label: 'this week' }}
            />
            <StatsCard
              title="Pending"
              value={stats.pending}
              icon={IconClock}
              description="Awaiting response"
            />
            <StatsCard
              title="Approved"
              value={stats.approved}
              icon={IconUserCheck}
              description="Ready for onboarding"
            />
            <StatsCard
              title="Converted"
              value={stats.converted}
              icon={IconTrendingUp}
              description="Became customers"
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-32 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Inquiries Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Inquiries</CardTitle>
                <CardDescription>All enterprise inquiry requests</CardDescription>
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as InquiryStatus | 'all')}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                    <SelectItem key={status} value={status}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {inquiries.length === 0 ? (
              <div className="text-center py-12">
                <IconInbox className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">No inquiries yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Enterprise inquiries will appear here when customers submit them.
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inquiries.map((inquiry) => {
                      const StatusIcon = STATUS_CONFIG[inquiry.status].icon;
                      return (
                        <TableRow
                          key={inquiry._id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedInquiryId(inquiry._id)}
                        >
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {inquiry.firstName} {inquiry.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">{inquiry.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{inquiry.companyName}</div>
                            <div className="text-sm text-muted-foreground">{inquiry.industry}</div>
                          </TableCell>
                          <TableCell>{inquiry.companySize}</TableCell>
                          <TableCell>{inquiry.expectedUsers}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_CONFIG[inquiry.status].variant}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {STATUS_CONFIG[inquiry.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span title={formatDateTime(inquiry.createdAt)}>
                              {formatRelativeTime(inquiry.createdAt)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <IconChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {paginationStatus === 'CanLoadMore' && (
                  <div className="flex justify-center mt-4">
                    <Button variant="outline" onClick={() => loadMore(20)}>
                      Load More
                    </Button>
                  </div>
                )}

                {paginationStatus === 'LoadingMore' && (
                  <div className="flex justify-center mt-4">
                    <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      {selectedInquiry && (
        <InquiryDetailDialog
          inquiry={selectedInquiry}
          open={!!selectedInquiryId}
          onOpenChange={(open) => {
            if (!open) setSelectedInquiryId(null);
          }}
          onStatusUpdate={handleStatusUpdate}
        />
      )}
    </div>
  );
}

