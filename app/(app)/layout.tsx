'use client';

import { OnboardingGuard } from '@/components/onboarding-guard';
import { UserProvider } from '@/components/user-provider';
import Dashboard from '@/components/dashboard/dashboard';
import { Authenticated } from 'convex/react';
import type { ReactNode } from 'react';

export default function AuthenticatedLayout({ children }: { readonly children: ReactNode }) {
  return (
    <Authenticated>
      <UserProvider>
        <OnboardingGuard>
          <Dashboard>{children}</Dashboard>
        </OnboardingGuard>
      </UserProvider>
    </Authenticated>
  );
}
