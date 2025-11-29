'use client';

import { api } from '@/convex/_generated/api';
import { useMutation } from 'convex/react';
import { useEffect, useRef, type ReactNode } from 'react';

interface UserProviderProps {
  children: ReactNode;
}

/**
 * Provisions the user in Convex immediately after authentication.
 * This ensures the user exists before the WorkOS webhook arrives,
 * preventing "Authentication required" errors.
 */
export function UserProvider({ children }: UserProviderProps) {
  const provision = useMutation(api.users.mutation.provision);
  const hasProvisioned = useRef(false);

  useEffect(() => {
    // Only provision once per mount
    if (hasProvisioned.current) return;
    hasProvisioned.current = true;

    // Provision user (no-op if already exists)
    provision().catch((error) => {
      // Ignore errors - user might not be authenticated yet
      console.debug('User provision skipped:', error.message);
    });
  }, [provision]);

  return <>{children}</>;
}

