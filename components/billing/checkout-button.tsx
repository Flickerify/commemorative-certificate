'use client';

import { useState, type ComponentProps } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface CheckoutButtonProps extends Omit<ComponentProps<typeof Button>, 'onClick'> {
  organizationId: Id<'organizations'>;
  priceId: string;
  children: React.ReactNode;
}

export function CheckoutButton({ organizationId, priceId, children, disabled, ...props }: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const createCheckout = useAction(api.billing.action.createCheckoutSession);

  const handleClick = async () => {
    try {
      setIsLoading(true);

      const successUrl = `${window.location.origin}/administration/billing?success=true`;
      const cancelUrl = `${window.location.origin}/administration/billing?canceled=true`;

      const { url } = await createCheckout({
        organizationId,
        priceId,
        successUrl,
        cancelUrl,
      });

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={disabled || isLoading} {...props}>
      {isLoading ? (
        <>
          <Spinner className="mr-2 h-4 w-4" />
          Loading…
        </>
      ) : (
        children
      )}
    </Button>
  );
}
