'use client';

import { ReactNode, useCallback } from 'react';
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
  const { user, loading: isLoading } = useAuth();
  const { getAccessToken } = useAccessToken();

  const loading = isLoading ?? false;
  const authenticated = !!user && !loading;

  const fetchAccessToken = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      return null;
    }
    return token;
  }, [getAccessToken]);

  return {
    isLoading: loading,
    isAuthenticated: authenticated,
    fetchAccessToken,
  };
}
