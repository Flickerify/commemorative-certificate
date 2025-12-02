'use client';

import { Spinner } from '@/components/ui/spinner';
import { api } from '@/convex/_generated/api';
import { useMutation } from 'convex/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface UserProviderProps {
  children: ReactNode;
}

/**
 * Provisions the user in Convex immediately after authentication.
 * This ensures the user exists before the WorkOS webhook arrives,
 * preventing "Authentication required" errors.
 *
 * Blocks rendering of children until provisioning is complete.
 */
export function UserProvider({ children }: UserProviderProps) {
  const provision = useMutation(api.users.mutation.provision);
  const hasProvisioned = useRef(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Only provision once per mount
    if (hasProvisioned.current) return;
    hasProvisioned.current = true;

    // Provision user (no-op if already exists)
    provision()
      .then(() => {
        setIsReady(true);
      })
      .catch((error) => {
        // Log error but still mark as ready - auth might fail later with proper error
        console.error('User provision failed:', error.message);
        setIsReady(true);
      });
  }, [provision]);

  // Block rendering until user is provisioned
  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return <>{children}</>;
}
