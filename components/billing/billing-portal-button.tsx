'use client';

import { ComponentProps, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface BillingPortalButtonProps extends Omit<ComponentProps<typeof Button>, 'onClick'> {
  organizationId: Id<'organizations'>;
  children: React.ReactNode;
}

export function BillingPortalButton({ organizationId, children, disabled, ...props }: BillingPortalButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const createPortal = useAction(api.billing.action.createBillingPortalSession);

  const handleClick = async () => {
    try {
      setIsLoading(true);

      const returnUrl = `${window.location.origin}/administration/billing`;

      const { url } = await createPortal({
        organizationId,
        returnUrl,
      });

      // Redirect to Stripe Billing Portal
      window.location.href = url;
    } catch (error) {
      console.error('Failed to create billing portal session:', error);
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
