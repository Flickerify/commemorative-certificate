'use client';

import { useAction, useQuery } from 'convex/react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/convex/_generated/api';
import { usePermissions } from '@/components/rbac';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useState, type ReactNode } from 'react';
import type { Id } from '@/convex/_generated/dataModel';
import {
  IconCreditCardPay,
  IconAlertTriangle,
  IconClock,
  IconRefresh,
  IconMail,
  IconLock,
  IconUserCircle,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

// Routes that are always accessible even with a paused subscription
// This allows billing admins to manage billing to resume the subscription
const ALLOWED_ROUTES_FOR_BILLING_ADMINS = ['/administration/billing', '/administration/organization', '/account'];

interface SubscriptionGuardProps {
  children: ReactNode;
}

/**
 * Guard that blocks access to the dashboard when the subscription is paused.
 * This happens when:
 * - The free trial ended without a payment method being added
 * - The subscription was paused for other reasons (e.g., payment failure)
 *
 * Behavior depends on user's permissions:
 * - Users with billing permission: Can add payment method to resume
 * - Users without billing permission: See a message to contact their admin
 */
export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { organizationId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isAddingPayment, setIsAddingPayment] = useState(false);

  // Get the organization from Convex using the WorkOS organizationId
  const organizations = useQuery(api.organizations.query.getOrganizationsByUserId);
  const currentOrg = organizations?.find((org) => org.externalId === organizationId);

  // Get subscription info
  const subscription = useQuery(
    api.billing.query.getOrganizationSubscription,
    currentOrg?._id ? { organizationId: currentOrg._id as Id<'organizations'> } : 'skip',
  );

  // Get user permissions
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canManageBilling = hasPermission('finance:billing:manage');

  const createBillingPortalSession = useAction(api.billing.action.createBillingPortalSession);

  // Loading state - wait for data
  if (organizations === undefined || (currentOrg && subscription === undefined) || permissionsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // No organization selected - let child components handle this
  if (!organizationId || !currentOrg) {
    return <>{children}</>;
  }

  // Personal workspace - no subscription guard needed
  if (subscription?.isPersonalWorkspace) {
    return <>{children}</>;
  }

  // Check if subscription is paused (trial ended without payment)
  const isPaused = subscription && !subscription.isPersonalWorkspace && subscription.status === 'paused';

  // Check if trial ended but subscription not yet paused (edge case)
  const isTrialExpired =
    subscription &&
    !subscription.isPersonalWorkspace &&
    subscription.isTrialing &&
    subscription.trialEndsAt &&
    subscription.trialEndsAt < new Date().getTime() &&
    !subscription.paymentMethodBrand;

  // If subscription is active or trialing (and not expired), allow access
  if (!isPaused && !isTrialExpired) {
    return <>{children}</>;
  }

  // Allow billing admins to access certain routes to manage the subscription
  if (canManageBilling && ALLOWED_ROUTES_FOR_BILLING_ADMINS.some((route) => pathname.startsWith(route))) {
    return <>{children}</>;
  }

  // Block access - show appropriate UI based on permissions
  const handleAddPaymentMethod = async () => {
    if (!currentOrg?._id) return;

    setIsAddingPayment(true);
    try {
      const returnUrl = `${window.location.origin}/administration/billing?resumed=true`;
      const { url } = await createBillingPortalSession({
        organizationId: currentOrg._id as Id<'organizations'>,
        returnUrl,
      });
      router.push(url);
    } catch (error) {
      console.error('Failed to open billing portal:', error);
      setIsAddingPayment(false);
    }
  };

  // UI for users WITHOUT billing permissions - they need to contact admin
  if (!canManageBilling) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        {/* Subtle background pattern */}
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,oklch(0.6_0.15_0/0.08),transparent)]" />

        <div className="w-full max-w-lg">
          <div className="rounded-2xl border border-amber-500/20 bg-card p-8 shadow-xl">
            {/* Icon */}
            <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center">
              <IconLock className="h-8 w-8 text-amber-500" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-center mb-2">Workspace Unavailable</h1>

            {/* Description */}
            <p className="text-center text-muted-foreground mb-6">
              The subscription for this workspace has been paused. Please contact your organization administrator to
              resume the subscription.
            </p>

            {/* Info card */}
            <div className="rounded-xl bg-muted/50 p-4 mb-6 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <IconClock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  Your data is safe and will be available once the subscription is resumed.
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <IconUserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  Only organization administrators can manage billing and resume the subscription.
                </span>
              </div>
            </div>

            {/* Organization info */}
            {currentOrg && (
              <div className="rounded-xl border border-border bg-background p-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {currentOrg.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{currentOrg.name}</p>
                    <p className="text-sm text-amber-600 dark:text-amber-400">Subscription Paused</p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions for non-billing users */}
            <div className="space-y-3">
              <Button variant="outline" className="w-full h-11" asChild>
                <a href="mailto:support@flickerify.com">
                  <IconMail className="h-4 w-4 mr-2" />
                  Contact Support
                </a>
              </Button>
            </div>

            {/* Footer note */}
            <p className="text-xs text-center text-muted-foreground mt-6">
              If you believe this is an error, please contact your organization administrator or reach out to us at{' '}
              <a href="mailto:support@flickerify.com" className="underline hover:text-foreground">
                support@flickerify.com
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // UI for users WITH billing permissions - they can add payment method
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,oklch(0.6_0.15_0/0.08),transparent)]" />

      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-red-500/20 bg-card p-8 shadow-xl">
          {/* Icon */}
          <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <IconAlertTriangle className="h-8 w-8 text-red-500" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center mb-2">Subscription Paused</h1>

          {/* Description */}
          <p className="text-center text-muted-foreground mb-6">
            {isPaused
              ? 'Your free trial has ended and no payment method was added. Add a payment method to resume your subscription and regain access to your workspace.'
              : 'Your free trial has expired. Add a payment method to continue using your workspace.'}
          </p>

          {/* Info card */}
          <div className="rounded-xl bg-muted/50 p-4 mb-6 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <IconClock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">
                Your data is safe and will be available once you resume your subscription.
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <IconCreditCardPay className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">You&apos;ll only be charged after adding a payment method.</span>
            </div>
          </div>

          {/* Organization info */}
          {currentOrg && (
            <div className="rounded-xl border border-border bg-background p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  {currentOrg.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{currentOrg.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {subscription && !subscription.isPersonalWorkspace ? subscription.tier : 'Personal'} Plan
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions for billing admins */}
          <div className="space-y-3">
            <Button
              onClick={handleAddPaymentMethod}
              disabled={isAddingPayment}
              className={cn('w-full h-12 text-base', 'bg-primary hover:bg-primary/90')}
            >
              {isAddingPayment ? (
                <>
                  <IconRefresh className="h-5 w-5 mr-2 animate-spin" />
                  Opening Billing Portal…
                </>
              ) : (
                <>
                  <IconCreditCardPay className="h-5 w-5 mr-2" />
                  Add Payment Method
                </>
              )}
            </Button>

            <Button variant="outline" className="w-full h-11" asChild>
              <a href="/administration/billing">Go to Billing Settings</a>
            </Button>

            <Button variant="ghost" className="w-full h-11" asChild>
              <a href="mailto:support@flickerify.com">
                <IconMail className="h-4 w-4 mr-2" />
                Contact Support
              </a>
            </Button>
          </div>

          {/* Footer note */}
          <p className="text-xs text-center text-muted-foreground mt-6">
            Questions? Contact us at{' '}
            <a href="mailto:support@flickerify.com" className="underline hover:text-foreground">
              support@flickerify.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
