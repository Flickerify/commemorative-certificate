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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  IconShieldCheck,
  IconCash,
  IconArrowDown,
  IconX,
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
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            {subscription.isWithinGuaranteePeriod && (
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                <IconShieldCheck className="mr-1 h-3 w-3" />
                Money-back guarantee
              </Badge>
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

        {/* Money-back guarantee banner */}
        {subscription.isWithinGuaranteePeriod && subscription.guaranteeDaysRemaining !== undefined && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-emerald-500/20 p-2">
                <IconShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 space-y-2">
                <p className="font-medium text-emerald-700 dark:text-emerald-300">30-day money-back guarantee</p>
                <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
                  {subscription.guaranteeDaysRemaining} day{subscription.guaranteeDaysRemaining === 1 ? '' : 's'}{' '}
                  remaining to request a full refund if you&apos;re not satisfied.
                </p>
                <MoneyBackRefundButton organizationId={organizationId} />
              </div>
            </div>
          </div>
        )}

        {/* Scheduled plan change (downgrade) */}
        {'hasScheduledChange' in subscription && subscription.hasScheduledChange && subscription.scheduledTier && (
          <ScheduledPlanChangeCard
            organizationId={organizationId}
            currentTier={subscription.tier}
            scheduledTier={subscription.scheduledTier}
            scheduledBillingInterval={subscription.scheduledBillingInterval}
            effectiveDate={subscription.currentPeriodEnd}
          />
        )}

        {/* Cancel warning (only show if no scheduled change) */}
        {subscription.cancelAtPeriodEnd && !('hasScheduledChange' in subscription && subscription.hasScheduledChange) && (subscription.cancelAt || subscription.currentPeriodEnd) && (
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

// ============================================================
// SCHEDULED PLAN CHANGE CARD
// ============================================================

interface ScheduledPlanChangeCardProps {
  organizationId: Id<'organizations'>;
  currentTier: 'personal' | 'pro' | 'enterprise';
  scheduledTier: 'personal' | 'pro' | 'enterprise';
  scheduledBillingInterval?: 'month' | 'year';
  effectiveDate?: number;
}

function ScheduledPlanChangeCard({
  organizationId,
  currentTier,
  scheduledTier,
  scheduledBillingInterval,
  effectiveDate,
}: ScheduledPlanChangeCardProps) {
  const [isCanceling, setIsCanceling] = useState(false);
  const cancelScheduledDowngrade = useAction(api.billing.action.cancelScheduledDowngrade);

  const handleCancelDowngrade = async () => {
    setIsCanceling(true);
    try {
      const result = await cancelScheduledDowngrade({ organizationId });
      if (result.success) {
        toast.success('Scheduled change canceled', {
          description: result.message,
        });
        // Refresh the page to show updated subscription status
        window.location.reload();
      } else {
        toast.error('Failed to cancel', {
          description: result.message,
        });
      }
    } catch (error) {
      console.error('Failed to cancel scheduled downgrade:', error);
      toast.error('Failed to cancel scheduled change', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsCanceling(false);
    }
  };

  const scheduledConfig = tierConfig[scheduledTier];
  const ScheduledIcon = scheduledConfig.icon;

  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-blue-500/20 p-2">
            <IconArrowDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="font-medium text-blue-700 dark:text-blue-300">Scheduled plan change</p>
            <p className="text-sm text-blue-600/80 dark:text-blue-400/80">
              Your subscription will change from{' '}
              <span className="font-medium capitalize">{currentTier}</span> to{' '}
              <span className="font-medium capitalize">{scheduledTier}</span>
              {scheduledBillingInterval && (
                <span className="text-muted-foreground">
                  {' '}({scheduledBillingInterval}ly billing)
                </span>
              )}
              {effectiveDate && (
                <span> on {new Date(effectiveDate).toLocaleDateString()}</span>
              )}
              .
            </p>
            <div className="flex items-center gap-2 pt-1">
              <div className={`rounded p-1 ${scheduledConfig.color} text-white`}>
                <ScheduledIcon className="h-3 w-3" />
              </div>
              <span className="text-xs text-muted-foreground">
                Next billing cycle: {scheduledConfig.name}
                {scheduledBillingInterval && ` (${scheduledBillingInterval}ly)`}
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancelDowngrade}
          disabled={isCanceling}
          className="shrink-0 border-blue-500/50 text-blue-700 hover:bg-blue-500/10 dark:text-blue-400"
        >
          {isCanceling ? (
            <IconLoader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <IconX className="mr-1 h-4 w-4" />
              Keep current plan
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// MONEY-BACK GUARANTEE REFUND BUTTON
// ============================================================

interface MoneyBackRefundButtonProps {
  organizationId: Id<'organizations'>;
}

function MoneyBackRefundButton({ organizationId }: MoneyBackRefundButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);
  const [reason, setReason] = useState('');
  const [eligibility, setEligibility] = useState<{
    eligible: boolean;
    reason: string;
    daysRemaining?: number;
    refundableAmount?: number;
    currency?: string;
  } | null>(null);

  const checkEligibility = useAction(api.billing.action.checkRefundEligibility);
  const requestRefund = useAction(api.billing.action.requestMoneyBackRefund);

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (open && !eligibility) {
      // Check eligibility when dialog opens
      setIsCheckingEligibility(true);
      try {
        const result = await checkEligibility({ organizationId });
        setEligibility(result);
      } catch (error) {
        console.error('Failed to check eligibility:', error);
        toast.error('Failed to check refund eligibility');
      } finally {
        setIsCheckingEligibility(false);
      }
    }
  };

  const handleRequestRefund = async () => {
    setIsProcessingRefund(true);
    try {
      const result = await requestRefund({
        organizationId,
        reason: reason || undefined,
      });

      if (result.success) {
        toast.success('Refund processed successfully', {
          description: result.message,
        });
        setIsOpen(false);
        // Refresh the page to show updated subscription status
        window.location.reload();
      } else {
        toast.error('Refund failed', {
          description: result.message,
        });
      }
    } catch (error) {
      console.error('Failed to process refund:', error);
      toast.error('Failed to process refund', {
        description: error instanceof Error ? error.message : 'Please try again or contact support',
      });
    } finally {
      setIsProcessingRefund(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-emerald-500/50 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
        >
          <IconCash className="mr-2 h-4 w-4" />
          Request Refund
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconShieldCheck className="h-5 w-5 text-emerald-500" />
            30-Day Money-Back Guarantee
          </DialogTitle>
          <DialogDescription>
            Request a full refund within 30 days of your first payment if you&apos;re not satisfied.
          </DialogDescription>
        </DialogHeader>

        {isCheckingEligibility ? (
          <div className="flex items-center justify-center py-8">
            <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : eligibility ? (
          <div className="space-y-4 py-4">
            {eligibility.eligible ? (
              <>
                {/* Eligible for refund */}
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <IconCheck className="h-5 w-5 text-emerald-500" />
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">Eligible for refund</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{eligibility.reason}</p>
                </div>

                {/* Refund amount */}
                {eligibility.refundableAmount && eligibility.currency && (
                  <div className="rounded-lg bg-muted p-4">
                    <div className="text-sm text-muted-foreground mb-1">Refund amount</div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(eligibility.refundableAmount, eligibility.currency)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      This amount will be refunded to your original payment method.
                    </p>
                  </div>
                )}

                {/* Feedback (optional) */}
                <div className="space-y-2">
                  <Label htmlFor="reason">Why are you requesting a refund? (optional)</Label>
                  <Textarea
                    id="reason"
                    placeholder="Help us improve by sharing your feedback…"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="resize-none"
                    rows={3}
                  />
                </div>

                {/* Warning */}
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm">
                  <IconAlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                  <div>
                    <span className="font-medium text-amber-600 dark:text-amber-400">Important:</span>{' '}
                    <span className="text-muted-foreground">
                      This will cancel your subscription immediately and you will lose access to all paid features.
                    </span>
                  </div>
                </div>
              </>
            ) : (
              /* Not eligible */
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconAlertTriangle className="h-5 w-5 text-red-500" />
                  <span className="font-medium text-red-700 dark:text-red-300">Not eligible for refund</span>
                </div>
                <p className="text-sm text-muted-foreground">{eligibility.reason}</p>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          {eligibility?.eligible && (
            <Button
              variant="destructive"
              onClick={handleRequestRefund}
              disabled={isProcessingRefund}
            >
              {isProcessingRefund ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <IconCash className="mr-2 h-4 w-4" />
                  Confirm Refund
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
