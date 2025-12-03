'use client';

import { useState } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BillingPortalButton } from './billing-portal-button';
import {
  IconCrown,
  IconBuilding,
  IconUser,
  IconUsers,
  IconCheck,
  IconInfinity,
  IconAlertTriangle,
  IconLoader2,
  IconCreditCard,
  IconRefresh,
  IconClock,
} from '@tabler/icons-react';
import { toast } from 'sonner';

interface SubscriptionCardProps {
  organizationId: Id<'organizations'>;
}

const tierConfig = {
  personal: {
    name: 'Personal',
    description: 'For individuals',
    icon: IconUser,
    color: 'bg-emerald-500',
    badgeVariant: 'secondary' as const,
  },
  pro: {
    name: 'Pro',
    description: 'For small teams',
    icon: IconUsers,
    color: 'bg-blue-500',
    badgeVariant: 'default' as const,
  },
  enterprise: {
    name: 'Enterprise',
    description: 'For larger organizations',
    icon: IconBuilding,
    color: 'bg-purple-500',
    badgeVariant: 'default' as const,
  },
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  trialing: { label: 'Trial', variant: 'secondary' },
  past_due: { label: 'Past Due', variant: 'destructive' },
  canceled: { label: 'Canceled', variant: 'outline' },
  incomplete: { label: 'Incomplete', variant: 'destructive' },
  unpaid: { label: 'Unpaid', variant: 'destructive' },
  paused: { label: 'Paused', variant: 'outline' },
  none: { label: 'No Subscription', variant: 'outline' },
};

export function SubscriptionCard({ organizationId }: SubscriptionCardProps) {
  const subscription = useQuery(api.billing.query.getOrganizationSubscription, { organizationId });
  const seatInfo = useQuery(api.billing.query.getSeatInfo, { organizationId });

  if (subscription === undefined || seatInfo === undefined) {
    return <SubscriptionCardSkeleton />;
  }

  // Handle personal workspace
  if (subscription.isPersonalWorkspace) {
    return <PersonalWorkspaceCard />;
  }

  // Handle pending setup (checkout not completed)
  if (subscription.isPendingSetup) {
    return <PendingSetupCard organizationId={organizationId} />;
  }

  const config = tierConfig[subscription.tier as keyof typeof tierConfig] ?? tierConfig.personal;
  const TierIcon = config.icon;
  const statusInfo = statusConfig[subscription.status] ?? statusConfig.none;

  return (
    <Card className="relative overflow-hidden">
      {/* Tier indicator stripe */}
      <div className={`absolute top-0 left-0 h-1 w-full ${config.color}`} />

      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${config.color} text-white`}>
              <TierIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {config.name}
                {subscription.tier === 'enterprise' && <IconCrown className="h-4 w-4 text-amber-500" />}
              </CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {subscription.isTrialing && subscription.trialDaysRemaining !== undefined ? (
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                <IconClock className="mr-1 h-3 w-3" />
                {subscription.trialDaysRemaining} day{subscription.trialDaysRemaining === 1 ? '' : 's'} left
              </Badge>
            ) : (
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Seat usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Team members</span>
            <span className="font-medium">
              {seatInfo.currentSeats} /{' '}
              {seatInfo.isUnlimited ? <IconInfinity className="inline h-4 w-4" /> : seatInfo.seatLimit}
            </span>
          </div>
          {!seatInfo.isUnlimited && <Progress value={seatInfo.utilizationPercent} className="h-2" />}
        </div>

        {/* Trial banner - prompt to add payment method */}
        {subscription.isTrialing && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-emerald-500/20 p-2">
                <IconClock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="font-medium text-emerald-700 dark:text-emerald-300">
                  {subscription.trialDaysRemaining !== undefined && subscription.trialDaysRemaining > 0
                    ? `${subscription.trialDaysRemaining} day${subscription.trialDaysRemaining === 1 ? '' : 's'} left in your trial`
                    : 'Your trial is ending soon'}
                </p>
                <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
                  {subscription.paymentMethodLast4
                    ? 'Your card will be charged when the trial ends.'
                    : 'Add a payment method to continue using the service after your trial.'}
                </p>
              </div>
            </div>
            {!subscription.paymentMethodLast4 && (
              <div className="mt-3 ml-11">
                <BillingPortalButton
                  organizationId={organizationId}
                  variant="default"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <IconCreditCard className="mr-2 h-4 w-4" />
                  Add Payment Method
                </BillingPortalButton>
              </div>
            )}
          </div>
        )}

        {/* Cancel warning */}
        {subscription.cancelAtPeriodEnd && (subscription.cancelAt || subscription.currentPeriodEnd) && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
            <IconAlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Subscription ends on{' '}
              {new Date(subscription.cancelAt ?? subscription.currentPeriodEnd!).toLocaleDateString()}
            </span>
          </div>
        )}

        {/* Features list */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Included features</h4>
          <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            {subscription.features.slice(0, 6).map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <IconCheck className="h-4 w-4 text-emerald-500" />
                {formatFeatureName(feature)}
              </li>
            ))}
          </ul>
        </div>

        {/* Billing info */}
        {subscription.billingInterval && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Billing cycle</span>
              <span className="font-medium capitalize">{subscription.billingInterval}ly</span>
            </div>
            {subscription.currentPeriodEnd && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-muted-foreground">Next billing date</span>
                <span className="font-medium">{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</span>
              </div>
            )}
            {subscription.paymentMethodLast4 && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-muted-foreground">Payment method</span>
                <span className="font-medium capitalize">
                  {subscription.paymentMethodBrand} •••• {subscription.paymentMethodLast4}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter>
        {subscription.hasActiveSubscription ? (
          <BillingPortalButton organizationId={organizationId} variant="outline" className="w-full">
            Manage Subscription
          </BillingPortalButton>
        ) : subscription.status === 'paused' ? (
          // Trial ended without payment method - direct to portal to add card
          <div className="flex flex-col gap-4 w-full">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-500/20 p-2">
                <IconAlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="font-medium text-red-700 dark:text-red-300">Your trial has ended</p>
                <p className="text-sm text-red-600/80 dark:text-red-400/80">
                  Add a payment method to reactivate your subscription and continue using the service.
                </p>
              </div>
            </div>
            <BillingPortalButton
              organizationId={organizationId}
              variant="default"
              className="w-full bg-red-600 hover:bg-red-700"
            >
              <IconCreditCard className="mr-2 h-4 w-4" />
              Add Payment Method
            </BillingPortalButton>
          </div>
        ) : subscription.status === 'past_due' || subscription.status === 'unpaid' ? (
          // Payment failed
          <div className="flex flex-col gap-2 w-full">
            <BillingPortalButton organizationId={organizationId} variant="default" className="w-full">
              <IconRefresh className="mr-2 h-4 w-4" />
              Update Payment Method
            </BillingPortalButton>
            <p className="text-xs text-muted-foreground text-center">
              Your payment failed. Please update your payment method to continue.
            </p>
          </div>
        ) : subscription.status === 'canceled' || subscription.cancelAtPeriodEnd ? (
          <div className="flex flex-col gap-2 w-full">
            <BillingPortalButton organizationId={organizationId} variant="default" className="w-full">
              <IconRefresh className="mr-2 h-4 w-4" />
              Manage Billing
            </BillingPortalButton>
            <p className="text-xs text-muted-foreground text-center">
              Create a new subscription in the billing portal to reactivate your account
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center w-full">
            Upgrade to Pro or Enterprise to unlock more features
          </p>
        )}
      </CardFooter>
    </Card>
  );
}

function PendingSetupCard({ organizationId }: { organizationId: Id<'organizations'> }) {
  const [isLoading, setIsLoading] = useState(false);
  const resumeCheckout = useAction(api.billing.action.resumeCheckout);

  const handleResumeCheckout = async () => {
    setIsLoading(true);
    try {
      const result = await resumeCheckout({
        organizationId,
        successUrl: `${window.location.origin}/administration/billing?success=true`,
        cancelUrl: `${window.location.origin}/administration/billing?canceled=true`,
      });

      // Redirect to Stripe checkout
      window.location.href = result.checkoutUrl;
    } catch (error) {
      console.error('Failed to resume checkout:', error);
      toast.error('Failed to resume checkout', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
      setIsLoading(false);
    }
  };

  const config = tierConfig.personal;
  const TierIcon = config.icon;

  return (
    <Card className="relative overflow-hidden border-amber-500/50">
      {/* Warning stripe */}
      <div className={`absolute top-0 left-0 h-1 w-full ${config.color}`} />

      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${config.color} text-white`}>
              <TierIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {config.name}
                <IconAlertTriangle className="h-4 w-4 text-amber-500" />
              </CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="border-amber-500 text-amber-600">
            Pending
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Warning message */}
        <div className="flex items-start gap-3 rounded-lg bg-amber-500/10 p-4 text-sm">
          <IconAlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="space-y-1">
            <p className="font-medium text-amber-600 dark:text-amber-400">Setup incomplete</p>
            <p className="text-muted-foreground">
              Your organization was created but the subscription checkout was not completed. Please complete the
              checkout to activate your subscription.
            </p>
          </div>
        </div>

        {/* What you'll get */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Complete setup to unlock:</h4>
          <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <IconCheck className="h-4 w-4 text-emerald-500" />
              Team collaboration
            </li>
            <li className="flex items-center gap-2">
              <IconCheck className="h-4 w-4 text-emerald-500" />
              Advanced features
            </li>
            <li className="flex items-center gap-2">
              <IconCheck className="h-4 w-4 text-emerald-500" />
              Priority support
            </li>
            <li className="flex items-center gap-2">
              <IconCheck className="h-4 w-4 text-emerald-500" />
              API access
            </li>
          </ul>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button onClick={handleResumeCheckout} disabled={isLoading} className="flex-1">
          {isLoading ? (
            <>
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </>
          ) : (
            <>
              <IconCreditCard className="mr-2 h-4 w-4" />
              Complete Setup
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

function PersonalWorkspaceCard() {
  const config = tierConfig.personal;
  const TierIcon = config.icon;

  return (
    <Card className="relative overflow-hidden">
      {/* Tier indicator stripe */}
      <div className={`absolute top-0 left-0 h-1 w-full ${config.color}`} />

      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${config.color} text-white`}>
              <TierIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{config.name}</CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </div>
          </div>
          <Badge variant="secondary">Free</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Seat info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Team members</span>
            <span className="font-medium">1 / 1</span>
          </div>
          <Progress value={100} className="h-2" />
        </div>

        {/* Features list */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Included features</h4>
          <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <IconCheck className="h-4 w-4 text-emerald-500" />
              Basic API
            </li>
            <li className="flex items-center gap-2">
              <IconCheck className="h-4 w-4 text-emerald-500" />
              Community Support
            </li>
          </ul>
        </div>

        {/* Upgrade notice */}
        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          Personal workspaces are free forever. Create an organization to unlock team features and paid plans.
        </div>
      </CardContent>

      <CardFooter>
        <a
          href="/organization/new"
          className="w-full inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Create Organization
        </a>
      </CardFooter>
    </Card>
  );
}

export function SubscriptionCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-2 w-full" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-4 w-24" />
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  );
}

function formatFeatureName(feature: string): string {
  return feature
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
