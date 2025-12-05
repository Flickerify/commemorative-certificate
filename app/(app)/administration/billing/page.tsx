'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { PageShell } from '@/components/dashboard/page-shell';
import { SubscriptionCard } from '@/components/billing/subscription-card';
import { PricingTable } from '@/components/billing/pricing-table';
import { BillingPortalButton } from '@/components/billing/billing-portal-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  IconCreditCard,
  IconReceipt,
  IconCheck,
  IconAlertCircle,
  IconBuilding,
  IconUsers,
  IconX,
  IconDownload,
  IconExternalLink,
  IconFileInvoice,
  IconRefresh,
  IconClock,
  IconCurrencyDollar,
  IconRotateClockwise,
  IconCalendar,
} from '@tabler/icons-react';
import type { Id } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';

export default function BillingPage() {
  const searchParams = useSearchParams();
  const { organizationId } = useAuth();

  // Initialize state from URL params to avoid calling setState in effect
  const [showSuccess, setShowSuccess] = useState(() => searchParams.get('success') === 'true');
  const [showCanceled, setShowCanceled] = useState(() => searchParams.get('canceled') === 'true');
  const [activeTab, setActiveTab] = useState('subscription');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Track if we've already processed the URL params
  const hasProcessedParams = useRef(false);

  // Get the organization from Convex using the WorkOS organizationId
  const organizations = useQuery(api.organizations.query.getOrganizationsByUserId);
  const currentOrg = organizations?.find((org) => org.externalId === organizationId);

  // Get subscription info
  const subscription = useQuery(
    api.billing.query.getOrganizationSubscription,
    currentOrg?._id ? { organizationId: currentOrg._id as Id<'organizations'> } : 'skip',
  );

  const seatInfo = useQuery(
    api.billing.query.getSeatInfo,
    currentOrg?._id ? { organizationId: currentOrg._id as Id<'organizations'> } : 'skip',
  );

  // Actions
  const syncAfterCheckout = useAction(api.billing.action.syncAfterCheckout);
  const getCompleteBillingData = useAction(api.billing.action.getCompleteBillingData);

  // State for comprehensive billing data
  type BillingData = {
    invoices: Array<{
      id: string;
      number: string | null;
      status: string;
      billingReason: string;
      amountDue: number;
      amountPaid: number;
      amountRemaining: number;
      currency: string;
      created: number;
      periodStart: number;
      periodEnd: number;
      hostedInvoiceUrl: string | null;
      invoicePdf: string | null;
      subscriptionId: string | null;
      planName: string | null;
      lineItems: Array<{ description: string; amount: number; quantity: number }>;
    }>;
    refunds: Array<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      reason: string | null;
      created: number;
      invoiceId: string | null;
      metadata: Record<string, string>;
    }>;
    subscriptions: Array<{
      id: string;
      status: string;
      planName: string;
      tier: string;
      interval: string;
      amount: number;
      currency: string;
      currentPeriodStart: number;
      currentPeriodEnd: number;
      cancelAtPeriodEnd: boolean;
      canceledAt: number | null;
      endedAt: number | null;
      created: number;
    }>;
    activity: Array<{
      id: string;
      type: string;
      description: string;
      details: string | null;
      status: string;
      created: number;
    }>;
  };

  const [billingData, setBillingData] = useState<BillingData | null>(null);

  // Handle success/canceled params side effects
  useEffect(() => {
    // Skip if already processed
    if (hasProcessedParams.current) return;

    if (showSuccess) {
      hasProcessedParams.current = true;

      // Sync subscription data after successful checkout
      if (currentOrg?._id) {
        syncAfterCheckout({ organizationId: currentOrg._id as Id<'organizations'> }).catch(console.error);
      }

      // Clear the success message after 5 seconds
      const timeout = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timeout);
    }

    if (showCanceled) {
      hasProcessedParams.current = true;
      const timeout = setTimeout(() => setShowCanceled(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [showSuccess, showCanceled, currentOrg?._id, syncAfterCheckout]);

  // Load billing data function - used by tab change and refresh
  const loadBillingData = (forceRefresh = false) => {
    if (currentOrg?._id && !isLoadingHistory && (forceRefresh || !billingData)) {
      setIsLoadingHistory(true);
      getCompleteBillingData({ organizationId: currentOrg._id as Id<'organizations'> })
        .then(setBillingData)
        .finally(() => setIsLoadingHistory(false));
    }
  };

  // Handle tab change - load billing data when switching to history tab
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    if (newTab === 'history' && currentOrg?._id && !billingData) {
      loadBillingData();
    }
  };

  const refreshHistory = () => {
    loadBillingData(true);
  };

  const isLoading = organizations === undefined || (currentOrg && subscription === undefined);
  const isPersonalWorkspace = subscription?.isPersonalWorkspace ?? false;

  return (
    <PageShell
      title="Billing"
      description="Manage your organization's subscription and billing"
      headerActions={
        subscription && !subscription.isPersonalWorkspace && subscription.hasActiveSubscription && currentOrg ? (
          <BillingPortalButton organizationId={currentOrg._id as Id<'organizations'>} variant="outline" size="sm">
            <IconReceipt className="mr-2 h-4 w-4" />
            Manage Billing
          </BillingPortalButton>
        ) : null
      }
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Success Alert */}
        {showSuccess && (
          <Alert className="border-emerald-500/50 bg-emerald-500/10">
            <IconCheck className="h-4 w-4 text-emerald-500" />
            <AlertTitle>Success!</AlertTitle>
            <AlertDescription>Your subscription has been updated successfully.</AlertDescription>
          </Alert>
        )}

        {/* Canceled Alert */}
        {showCanceled && (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <IconX className="h-4 w-4 text-amber-500" />
            <AlertTitle>Checkout Canceled</AlertTitle>
            <AlertDescription>Your checkout was canceled. You can try again when you&apos;re ready.</AlertDescription>
          </Alert>
        )}

        {/* No Organization Selected */}
        {!organizationId && (
          <Alert variant="destructive">
            <IconAlertCircle className="h-4 w-4" />
            <AlertTitle>No Organization Selected</AlertTitle>
            <AlertDescription>Please select an organization to view billing information.</AlertDescription>
          </Alert>
        )}

        {/* Personal Workspace Notice */}
        {isPersonalWorkspace && (
          <Alert>
            <IconBuilding className="h-4 w-4" />
            <AlertTitle>Personal Workspace</AlertTitle>
            <AlertDescription>
              Personal workspaces are free forever. Create an organization to access paid plans with team features.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <BillingPageSkeleton />
        ) : currentOrg && !isPersonalWorkspace ? (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="subscription" className="gap-2">
                <IconCreditCard className="h-4 w-4" />
                Subscription
              </TabsTrigger>
              <TabsTrigger value="usage" className="gap-2">
                <IconUsers className="h-4 w-4" />
                Usage
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <IconReceipt className="h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            {/* Subscription Tab (Merged Overview + Plans) */}
            <TabsContent value="subscription" className="space-y-8">
              {/* Current Subscription & Stats */}
              <div className="grid gap-6 md:grid-cols-2">
                <SubscriptionCard organizationId={currentOrg._id as Id<'organizations'>} />

                {/* Quick Stats Card */}
                <div className="rounded-xl border border-border bg-card p-6 space-y-6">
                  <h3 className="font-semibold">Quick Stats</h3>

                  {seatInfo && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Team Size</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {seatInfo.currentSeats} / {seatInfo.isUnlimited ? '∞' : seatInfo.seatLimit}
                          </span>
                          {!seatInfo.canAddMember && (
                            <Badge variant="secondary" className="text-xs">
                              Limit Reached
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Current Plan</span>
                        <Badge variant="outline" className="capitalize">
                          {seatInfo.tier}
                        </Badge>
                      </div>

                      {subscription && !subscription.isPersonalWorkspace && subscription.billingInterval && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Billing Cycle</span>
                          <span className="font-medium capitalize">{subscription.billingInterval}ly</span>
                        </div>
                      )}

                      {subscription && !subscription.isPersonalWorkspace && subscription.currentPeriodEnd && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Next Billing</span>
                          <span className="font-medium">
                            {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Plans Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Available Plans</h3>
                  {subscription && !subscription.isPersonalWorkspace && subscription.hasActiveSubscription && (
                    <p className="text-sm text-muted-foreground">
                      {subscription.tier === 'enterprise' ? 'You have the highest plan' : 'Upgrade or change your plan'}
                    </p>
                  )}
                </div>
                <PricingTable
                  organizationId={currentOrg._id as Id<'organizations'>}
                  currentTier={
                    subscription && !subscription.isPersonalWorkspace && subscription.hasActiveSubscription
                      ? (subscription.tier as 'pro' | 'enterprise' | 'personal')
                      : undefined
                  }
                  currentInterval={
                    subscription && subscription.hasActiveSubscription && subscription.billingInterval
                      ? (subscription.billingInterval as 'month' | 'year')
                      : undefined
                  }
                  hasCanceledSubscription={
                    subscription &&
                    !subscription.isPersonalWorkspace &&
                    !subscription.hasActiveSubscription &&
                    (subscription.status === 'canceled' ||
                      subscription.status === 'paused' ||
                      subscription.status === 'past_due' ||
                      subscription.status === 'unpaid' ||
                      subscription.cancelAtPeriodEnd)
                  }
                />
              </div>
            </TabsContent>

            {/* Usage Tab */}
            <TabsContent value="usage" className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-semibold mb-4">Usage This Period</h3>

                {seatInfo && (
                  <div className="grid gap-6 md:grid-cols-3">
                    <UsageCard
                      title="Team Members"
                      current={seatInfo.currentSeats}
                      limit={seatInfo.isUnlimited ? undefined : seatInfo.seatLimit}
                      unit="seats"
                    />
                    <UsageCard
                      title="API Calls"
                      current={0}
                      limit={
                        subscription && !subscription.isPersonalWorkspace && subscription.tier === 'enterprise'
                          ? undefined
                          : 10000
                      }
                      unit="calls"
                    />
                    <UsageCard
                      title="Storage"
                      current={0}
                      limit={
                        subscription && !subscription.isPersonalWorkspace && subscription.tier === 'enterprise'
                          ? undefined
                          : 1024
                      }
                      unit="MB"
                    />
                  </div>
                )}

                <p className="text-sm text-muted-foreground mt-6">
                  Usage resets at the beginning of each billing period.
                </p>
              </div>
            </TabsContent>

            {/* History Tab (Comprehensive Redesign) */}
            <TabsContent value="history" className="space-y-6">
              {/* Header with refresh */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Billing History</h3>
                  <p className="text-sm text-muted-foreground">
                    View invoices, refunds, subscriptions, and account activity
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={refreshHistory} disabled={isLoadingHistory}>
                  <IconRefresh className={cn('h-4 w-4 mr-2', isLoadingHistory && 'animate-spin')} />
                  Refresh
                </Button>
              </div>

              {isLoadingHistory ? (
                <div className="space-y-6">
                  <Skeleton className="h-64 w-full rounded-xl" />
                  <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-48 rounded-xl" />
                    <Skeleton className="h-48 rounded-xl" />
                  </div>
                </div>
              ) : !billingData || (billingData.invoices.length === 0 && billingData.subscriptions.length === 0) ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center">
                  <IconFileInvoice className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No billing history found.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your invoices and subscription events will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Invoices Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <IconFileInvoice className="h-5 w-5" />
                        Invoices
                      </CardTitle>
                      <CardDescription>All invoices and payment records</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {billingData.invoices.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No invoices yet</p>
                      ) : (
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Invoice</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {billingData.invoices.map((invoice) => (
                                <TableRow key={invoice.id}>
                                  <TableCell className="font-mono text-sm">
                                    {invoice.number || invoice.id.slice(0, 8)}
                                  </TableCell>
                                  <TableCell>{new Date(invoice.created).toLocaleDateString()}</TableCell>
                                  <TableCell>
                                    <div>
                                      <span className="font-medium">
                                        {getBillingReasonLabel(invoice.billingReason)}
                                      </span>
                                      {invoice.planName && (
                                        <span className="text-muted-foreground ml-1">• {invoice.planName}</span>
                                      )}
                                    </div>
                                    {invoice.lineItems.length > 1 && (
                                      <span className="text-xs text-muted-foreground">
                                        {invoice.lineItems.length} items
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <InvoiceStatusBadge status={invoice.status} />
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(invoice.amountPaid, invoice.currency)}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      {invoice.hostedInvoiceUrl && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                          <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                                            <IconExternalLink className="h-4 w-4" />
                                          </a>
                                        </Button>
                                      )}
                                      {invoice.invoicePdf && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                          <a
                                            href={invoice.invoicePdf}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download
                                          >
                                            <IconDownload className="h-4 w-4" />
                                          </a>
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Refunds & Subscriptions Grid */}
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Refunds Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <IconRotateClockwise className="h-5 w-5" />
                          Refunds
                        </CardTitle>
                        <CardDescription>All refunds issued to your account</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {billingData.refunds.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">No refunds</p>
                        ) : (
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-3">
                              {billingData.refunds.map((refund) => (
                                <div
                                  key={refund.id}
                                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                                >
                                  <div>
                                    <div className="font-medium">{formatCurrency(refund.amount, refund.currency)}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {new Date(refund.created).toLocaleDateString()}
                                      {refund.reason && ` • ${formatRefundReason(refund.reason)}`}
                                    </div>
                                    {refund.metadata.type && (
                                      <Badge variant="outline" className="mt-1 text-xs">
                                        {refund.metadata.type.replace(/_/g, ' ')}
                                      </Badge>
                                    )}
                                  </div>
                                  <RefundStatusBadge status={refund.status} />
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </CardContent>
                    </Card>

                    {/* Subscriptions Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <IconCreditCard className="h-5 w-5" />
                          Subscriptions
                        </CardTitle>
                        <CardDescription>All past and current subscriptions</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {billingData.subscriptions.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">No subscriptions</p>
                        ) : (
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-3">
                              {billingData.subscriptions.map((sub) => (
                                <div
                                  key={sub.id}
                                  className={cn(
                                    'p-3 rounded-lg border',
                                    sub.status === 'active' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-muted/50',
                                  )}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="font-medium capitalize">{sub.tier} Plan</div>
                                    <SubscriptionStatusBadge
                                      status={sub.status}
                                      cancelAtPeriodEnd={sub.cancelAtPeriodEnd}
                                    />
                                  </div>
                                  <div className="text-sm text-muted-foreground space-y-1">
                                    <div className="flex items-center gap-1">
                                      <IconCurrencyDollar className="h-3.5 w-3.5" />
                                      {formatCurrency(sub.amount, sub.currency)}/{sub.interval}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <IconCalendar className="h-3.5 w-3.5" />
                                      {sub.status === 'active' || sub.status === 'trialing'
                                        ? `Renews ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                                        : sub.endedAt
                                          ? `Ended ${new Date(sub.endedAt).toLocaleDateString()}`
                                          : `Created ${new Date(sub.created).toLocaleDateString()}`}
                                    </div>
                                    {sub.cancelAtPeriodEnd && (
                                      <div className="text-amber-600 dark:text-amber-400 text-xs">
                                        Cancels at period end
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Account Activity Timeline */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <IconClock className="h-5 w-5" />
                        Account Activity
                      </CardTitle>
                      <CardDescription>Recent billing and subscription events</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {billingData.activity.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
                      ) : (
                        <ScrollArea className="h-[300px]">
                          <div className="relative">
                            {/* Timeline line */}
                            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

                            <div className="space-y-4">
                              {billingData.activity.map((event) => (
                                <div key={event.id} className="relative pl-10">
                                  {/* Timeline dot */}
                                  <div
                                    className={cn(
                                      'absolute left-2.5 w-3 h-3 rounded-full border-2 bg-background',
                                      getActivityDotColor(event.status),
                                    )}
                                  />

                                  <div className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-medium">{event.description}</span>
                                      <ActivityStatusBadge status={event.status} />
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span>{new Date(event.created).toLocaleDateString()}</span>
                                      <span>•</span>
                                      <span>
                                        {new Date(event.created).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                      {event.details && (
                                        <>
                                          <span>•</span>
                                          <span>{event.details}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : isPersonalWorkspace && currentOrg ? (
          // Show pricing for personal workspaces
          <div className="space-y-6">
            <div className="text-center py-8">
              <IconBuilding className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Unlock Team Features</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Create an organization to access Pro and Enterprise plans with team collaboration, advanced features,
                and priority support.
              </p>
              <a
                href="/organization/new"
                className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Create Organization
              </a>
            </div>

            <PricingTable currentTier="personal" />
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function getBillingReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    subscription_create: 'Subscription started',
    subscription_cycle: 'Subscription renewal',
    subscription_update: 'Subscription updated',
    subscription_threshold: 'Usage threshold',
    manual: 'Manual invoice',
    upcoming: 'Upcoming invoice',
    unknown: 'Invoice',
  };
  return labels[reason] || reason.replace(/_/g, ' ');
}

function formatRefundReason(reason: string): string {
  const labels: Record<string, string> = {
    duplicate: 'Duplicate charge',
    fraudulent: 'Fraudulent',
    requested_by_customer: 'Customer request',
    expired_uncaptured_charge: 'Expired charge',
  };
  return labels[reason] || reason.replace(/_/g, ' ');
}

function getActivityDotColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'border-emerald-500';
    case 'failed':
      return 'border-red-500';
    case 'canceled':
      return 'border-red-500';
    case 'paused':
      return 'border-amber-500';
    default:
      return 'border-muted-foreground';
  }
}

// ============================================================
// STATUS BADGES
// ============================================================

function InvoiceStatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; label: string }> = {
    paid: { className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'Paid' },
    open: { className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Open' },
    draft: { className: 'bg-muted text-muted-foreground', label: 'Draft' },
    void: { className: 'bg-red-500/10 text-red-600 dark:text-red-400', label: 'Void' },
    uncollectible: { className: 'bg-red-500/10 text-red-600 dark:text-red-400', label: 'Uncollectible' },
  };

  const { className, label } = config[status] || { className: '', label: status };
  return (
    <Badge variant="secondary" className={cn('text-xs', className)}>
      {label}
    </Badge>
  );
}

function RefundStatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; label: string }> = {
    succeeded: { className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'Succeeded' },
    pending: { className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Pending' },
    failed: { className: 'bg-red-500/10 text-red-600 dark:text-red-400', label: 'Failed' },
    canceled: { className: 'bg-muted text-muted-foreground', label: 'Canceled' },
    requires_action: { className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Action Required' },
  };

  const { className, label } = config[status] || { className: '', label: status };
  return (
    <Badge variant="secondary" className={cn('text-xs', className)}>
      {label}
    </Badge>
  );
}

function SubscriptionStatusBadge({ status, cancelAtPeriodEnd }: { status: string; cancelAtPeriodEnd: boolean }) {
  if (cancelAtPeriodEnd && status === 'active') {
    return (
      <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400">
        Canceling
      </Badge>
    );
  }

  const config: Record<string, { className: string; label: string }> = {
    active: { className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'Active' },
    trialing: { className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', label: 'Trial' },
    past_due: { className: 'bg-red-500/10 text-red-600 dark:text-red-400', label: 'Past Due' },
    canceled: { className: 'bg-muted text-muted-foreground', label: 'Canceled' },
    unpaid: { className: 'bg-red-500/10 text-red-600 dark:text-red-400', label: 'Unpaid' },
    incomplete: { className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Incomplete' },
    incomplete_expired: { className: 'bg-muted text-muted-foreground', label: 'Expired' },
    paused: { className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Paused' },
  };

  const { className, label } = config[status] || { className: '', label: status };
  return (
    <Badge variant="secondary" className={cn('text-xs', className)}>
      {label}
    </Badge>
  );
}

function ActivityStatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; label: string }> = {
    completed: { className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'Completed' },
    failed: { className: 'bg-red-500/10 text-red-600 dark:text-red-400', label: 'Failed' },
    canceled: { className: 'bg-muted text-muted-foreground', label: 'Canceled' },
    paused: { className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Paused' },
  };

  const { className, label } = config[status] || { className: '', label: status };
  return (
    <Badge variant="secondary" className={cn('text-xs', className)}>
      {label}
    </Badge>
  );
}

interface UsageCardProps {
  title: string;
  current: number;
  limit?: number;
  unit: string;
}

function UsageCard({ title, current, limit, unit }: UsageCardProps) {
  const percentage = limit ? Math.min((current / limit) * 100, 100) : 0;
  const isUnlimited = limit === undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{title}</span>
        <span className="font-medium">
          {current.toLocaleString()} {!isUnlimited && `/ ${limit?.toLocaleString()}`} {unit}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${percentage}%` }} />
        </div>
      )}
      {isUnlimited && (
        <div className="h-2 rounded-full bg-emerald-500/20">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
        </div>
      )}
    </div>
  );
}

function BillingPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-24" />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
