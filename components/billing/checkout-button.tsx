'use client';

import { useState, type ComponentProps } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { SubscriptionChangeModal, getChangeType, type SubscriptionChangeDetails } from './subscription-change-modal';

interface CheckoutButtonProps extends Omit<ComponentProps<typeof Button>, 'onClick'> {
  organizationId: Id<'organizations'>;
  priceId: string;
  /** If true, uses updateSubscription (for plan changes). If false, uses createCheckoutSession (for new subscriptions). */
  hasActiveSubscription?: boolean;
  children: React.ReactNode;
}

// Map price IDs to tiers and intervals
// These should match your NEXT_PUBLIC_PRICE_* env vars
function getPriceDetails(priceId: string): { tier: 'personal' | 'pro' | 'enterprise'; interval: 'month' | 'year' } {
  const priceMap: Record<string, { tier: 'personal' | 'pro' | 'enterprise'; interval: 'month' | 'year' }> = {
    [process.env.NEXT_PUBLIC_PRICE_PERSONAL_MONTHLY ?? '']: { tier: 'personal', interval: 'month' },
    [process.env.NEXT_PUBLIC_PRICE_PERSONAL_YEARLY ?? '']: { tier: 'personal', interval: 'year' },
    [process.env.NEXT_PUBLIC_PRICE_PRO_MONTHLY ?? '']: { tier: 'pro', interval: 'month' },
    [process.env.NEXT_PUBLIC_PRICE_PRO_YEARLY ?? '']: { tier: 'pro', interval: 'year' },
    [process.env.NEXT_PUBLIC_PRICE_ENTERPRISE_MONTHLY ?? '']: { tier: 'enterprise', interval: 'month' },
    [process.env.NEXT_PUBLIC_PRICE_ENTERPRISE_YEARLY ?? '']: { tier: 'enterprise', interval: 'year' },
  };

  return priceMap[priceId] ?? { tier: 'personal', interval: 'month' };
}

export function CheckoutButton({
  organizationId,
  priceId,
  hasActiveSubscription = false,
  children,
  disabled,
  ...props
}: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const createCheckout = useAction(api.billing.action.createCheckoutSession);
  const updateSubscription = useAction(api.billing.action.updateSubscription);
  const endTrialAndStartPaying = useAction(api.billing.action.endTrialAndStartPaying);

  // Get current subscription details for the confirmation modal
  const subscription = useQuery(api.billing.query.getOrganizationSubscription, { organizationId });

  // Get the target plan details from price ID
  const targetPlan = getPriceDetails(priceId);

  // Determine current plan details
  const currentTier = (subscription && !subscription.isPersonalWorkspace ? subscription.tier : 'personal') as
    | 'personal'
    | 'pro'
    | 'enterprise';
  const currentInterval = (subscription?.billingInterval ?? 'month') as 'month' | 'year';
  const isTrialing = subscription?.isTrialing ?? false;
  const trialEndsAt = subscription?.trialEndsAt;
  const currentPeriodEnd = subscription?.currentPeriodEnd;

  // Build change details for the modal
  const changeDetails: SubscriptionChangeDetails = {
    changeType: getChangeType(currentTier, targetPlan.tier, currentInterval, targetPlan.interval),
    currentTier,
    newTier: targetPlan.tier,
    currentInterval,
    newInterval: targetPlan.interval,
    isTrialing,
    trialEndsAt,
    currentPeriodEnd,
  };

  // Check if this is actually a change (not the same plan)
  const isSamePlan = currentTier === targetPlan.tier && currentInterval === targetPlan.interval;

  const handleClick = () => {
    if (hasActiveSubscription && !isSamePlan) {
      // Show confirmation modal for subscription changes
      setShowConfirmModal(true);
    } else {
      // Direct checkout for new subscriptions
      handleCheckout();
    }
  };

  const handleCheckout = async () => {
    try {
      setIsLoading(true);

      const successUrl = `${window.location.origin}/administration/billing?success=true`;
      const cancelUrl = `${window.location.origin}/administration/billing?canceled=true`;

      if (hasActiveSubscription) {
        // Update existing subscription (no checkout needed)
        const result = await updateSubscription({
          organizationId,
          priceId,
          successUrl,
        });

        if (result.success) {
          toast.success(result.message);
          setShowConfirmModal(false);
          // Refresh the page to show updated subscription
          window.location.href = successUrl;
        } else {
          toast.error(result.message);
          setIsLoading(false);
        }
      } else {
        // Create new checkout session for new subscription
        const { url } = await createCheckout({
          organizationId,
          priceId,
          successUrl,
          cancelUrl,
        });

        // Redirect to Stripe Checkout
        window.location.href = url;
      }
    } catch (error) {
      console.error('Failed to process subscription:', error);
      toast.error('Failed to process subscription. Please try again.');
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    await handleCheckout();
  };

  // Handle "start paying now" - ends trial early and starts subscription
  const handleStartPayingNow = async () => {
    try {
      setIsLoading(true);

      const successUrl = `${window.location.origin}/administration/billing?success=true`;

      // End trial and start paying with the selected plan
      const result = await endTrialAndStartPaying({
        organizationId,
        priceId, // Use the new plan they selected
      });

      if (result.success) {
        toast.success(result.message);
        setShowConfirmModal(false);
        // Refresh the page to show updated subscription
        window.location.href = successUrl;
      } else {
        toast.error(result.message);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to start subscription:', error);
      toast.error('Failed to activate subscription. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button onClick={handleClick} disabled={disabled || isLoading} {...props}>
        {isLoading ? (
          <>
            <Spinner className="mr-2 h-4 w-4" />
            {hasActiveSubscription ? 'Updating…' : 'Loading…'}
          </>
        ) : (
          children
        )}
      </Button>

      {/* Subscription Change Confirmation Modal */}
      {hasActiveSubscription && (
        <SubscriptionChangeModal
          open={showConfirmModal}
          onOpenChange={setShowConfirmModal}
          details={changeDetails}
          onConfirm={handleConfirm}
          onStartPayingNow={isTrialing ? handleStartPayingNow : undefined}
          isLoading={isLoading}
        />
      )}
    </>
  );
}
