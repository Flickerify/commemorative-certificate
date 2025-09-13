'use client';

import { ReactNode, useCallback, useRef } from 'react';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithAuth } from 'convex/react';
import { AuthKitProvider, useAuth, useAccessToken } from '@workos-inc/authkit-nextjs/components';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!, { expectAuth: true });

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <AuthKitProvider>
      <ConvexProviderWithAuth client={convex} useAuth={useAuthFromAuthKit}>
        {children}
      </ConvexProviderWithAuth>
    </AuthKitProvider>
  );
}

function useAuthFromAuthKit() {
  const { user, loading: isUserLoading } = useAuth({ ensureSignedIn: true });
  const { getAccessToken, loading: isTokenLoading, error: tokenError } = useAccessToken();

  const isLoading = (isUserLoading ?? false) || (isTokenLoading ?? false);
  const isAuthenticated = !!user;

  const fetchAccessToken = useCallback(async () => {
    if (tokenError) return null;
    const token = await getAccessToken();
    return token ?? null;
  }, [getAccessToken, tokenError]);

  return {
    isLoading,
    isAuthenticated,
    fetchAccessToken,
  };
}
