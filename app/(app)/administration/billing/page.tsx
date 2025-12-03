'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { PageShell } from '@/components/dashboard/page-shell';
import { SubscriptionCard } from '@/components/billing/subscription-card';
import { PricingTable, PricingTableSkeleton } from '@/components/billing/pricing-table';
import { BillingPortalButton } from '@/components/billing/billing-portal-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  IconPlayerPlay,
  IconPlayerPause,
  IconArrowUp,
  IconArrowDown,
} from '@tabler/icons-react';
import type { Id } from '@/convex/_generated/dataModel';

export default function BillingPage() {
  const searchParams = useSearchParams();
  const { organizationId } = useAuth();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCanceled, setShowCanceled] = useState(false);
  const [activeTab, setActiveTab] = useState('subscription');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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
  const getBillingHistory = useAction(api.billing.action.getBillingHistory);

  // State for billing history
  const [billingHistory, setBillingHistory] = useState<
    Array<{
      id: string;
      type: string;
      description: string;
      amount?: number;
      currency?: string;
      status: string;
      created: number;
      invoiceUrl?: string;
      invoicePdf?: string;
    }>
  >([]);

  // Check for success/canceled params and sync
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccess(true);

      // Sync subscription data after successful checkout
      if (currentOrg?._id) {
        syncAfterCheckout({ organizationId: currentOrg._id as Id<'organizations'> }).catch(console.error);
      }

      // Clear the success message after 5 seconds
      const timeout = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timeout);
    }

    if (searchParams.get('canceled') === 'true') {
      setShowCanceled(true);
      const timeout = setTimeout(() => setShowCanceled(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [searchParams, currentOrg?._id, syncAfterCheckout]);

  // Load billing history when tab changes
  useEffect(() => {
    if (activeTab === 'history' && currentOrg?._id && billingHistory.length === 0) {
      setIsLoadingHistory(true);
      getBillingHistory({ organizationId: currentOrg._id as Id<'organizations'>, limit: 30 })
        .then(setBillingHistory)
        .finally(() => setIsLoadingHistory(false));
    }
  }, [activeTab, currentOrg?._id, getBillingHistory, billingHistory.length]);

  const refreshHistory = () => {
    if (currentOrg?._id) {
      setIsLoadingHistory(true);
      getBillingHistory({ organizationId: currentOrg._id as Id<'organizations'>, limit: 30 })
        .then(setBillingHistory)
        .finally(() => setIsLoadingHistory(false));
    }
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
                  isTrialEnded={
                    subscription &&
                    !subscription.isPersonalWorkspace &&
                    subscription.status === 'paused' &&
                    subscription.tier === 'personal'
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

            {/* History Tab (Redesigned) */}
            <TabsContent value="history" className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold">Billing History</h3>
                    <p className="text-sm text-muted-foreground mt-1">View your invoices and subscription events</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={refreshHistory} disabled={isLoadingHistory}>
                    <IconRefresh className={`h-4 w-4 mr-2 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                {isLoadingHistory ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : billingHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <IconFileInvoice className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No billing history found.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your invoices and subscription events will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {billingHistory.map((event) => (
                      <BillingHistoryItem key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </div>
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

interface BillingHistoryItemProps {
  event: {
    id: string;
    type: string;
    description: string;
    amount?: number;
    currency?: string;
    status: string;
    created: number;
    invoiceUrl?: string;
    invoicePdf?: string;
  };
}

function BillingHistoryItem({ event }: BillingHistoryItemProps) {
  const getIcon = () => {
    if (event.type === 'invoice') {
      if (event.status === 'paid') return <IconCheck className="h-4 w-4 text-emerald-500" />;
      if (event.status === 'open') return <IconClock className="h-4 w-4 text-amber-500" />;
      if (event.status === 'void' || event.status === 'uncollectible')
        return <IconX className="h-4 w-4 text-red-500" />;
      return <IconFileInvoice className="h-4 w-4 text-muted-foreground" />;
    }
    // Subscription events
    if (event.description.includes('created') || event.description.includes('started'))
      return <IconPlayerPlay className="h-4 w-4 text-emerald-500" />;
    if (event.description.includes('canceled') || event.description.includes('deleted'))
      return <IconX className="h-4 w-4 text-red-500" />;
    if (event.description.includes('paused')) return <IconPlayerPause className="h-4 w-4 text-amber-500" />;
    if (event.description.includes('resumed')) return <IconPlayerPlay className="h-4 w-4 text-emerald-500" />;
    if (event.description.includes('updated')) return <IconRefresh className="h-4 w-4 text-blue-500" />;
    if (event.description.includes('upgrade')) return <IconArrowUp className="h-4 w-4 text-emerald-500" />;
    if (event.description.includes('downgrade')) return <IconArrowDown className="h-4 w-4 text-amber-500" />;
    return <IconClock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = () => {
    const statusColors: Record<string, string> = {
      paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      open: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      draft: 'bg-muted text-muted-foreground',
      void: 'bg-red-500/10 text-red-600 dark:text-red-400',
      uncollectible: 'bg-red-500/10 text-red-600 dark:text-red-400',
      completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      canceled: 'bg-red-500/10 text-red-600 dark:text-red-400',
      paused: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    };

    return (
      <Badge variant="secondary" className={`text-xs ${statusColors[event.status] || ''}`}>
        {event.status === 'paid' ? 'Paid' : event.status.charAt(0).toUpperCase() + event.status.slice(1)}
      </Badge>
    );
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  return (
    <div className="flex items-start gap-4 rounded-lg border border-border bg-muted/30 p-4 hover:bg-muted/50 transition-colors">
      {/* Icon */}
      <div className="shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">{getIcon()}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium">{event.description}</span>
          {getStatusBadge()}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{new Date(event.created).toLocaleDateString()}</span>
          <span>{new Date(event.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {event.amount !== undefined && event.currency && (
            <span className="font-medium text-foreground">{formatAmount(event.amount, event.currency)}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      {event.type === 'invoice' && (event.invoiceUrl || event.invoicePdf) && (
        <div className="flex items-center gap-2">
          {event.invoiceUrl && (
            <Button variant="ghost" size="sm" asChild>
              <a href={event.invoiceUrl} target="_blank" rel="noopener noreferrer">
                <IconExternalLink className="h-4 w-4" />
                <span className="sr-only">View Invoice</span>
              </a>
            </Button>
          )}
          {event.invoicePdf && (
            <Button variant="ghost" size="sm" asChild>
              <a href={event.invoicePdf} target="_blank" rel="noopener noreferrer" download>
                <IconDownload className="h-4 w-4" />
                <span className="sr-only">Download PDF</span>
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
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
