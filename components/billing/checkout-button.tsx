'use client';

import { useState, type ComponentProps } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';

interface CheckoutButtonProps extends Omit<ComponentProps<typeof Button>, 'onClick'> {
  organizationId: Id<'organizations'>;
  priceId: string;
  /** If true, uses updateSubscription (for plan changes). If false, uses createCheckoutSession (for new subscriptions). */
  hasActiveSubscription?: boolean;
  children: React.ReactNode;
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
  const createCheckout = useAction(api.billing.action.createCheckoutSession);
  const updateSubscription = useAction(api.billing.action.updateSubscription);

  const handleClick = async () => {
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

  return (
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
  );
}
