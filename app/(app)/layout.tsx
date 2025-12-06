'use client';

import { OnboardingGuard } from '@/components/onboarding-guard';
import { SubscriptionGuard } from '@/components/subscription-guard';
import Dashboard from '@/components/dashboard/dashboard';
import { PermissionProvider } from '@/components/rbac';
import { Authenticated } from 'convex/react';
import type { ReactNode } from 'react';

export default function AuthenticatedLayout({ children }: { readonly children: ReactNode }) {
  return (
    <Authenticated>
      <OnboardingGuard>
        <PermissionProvider>
          <SubscriptionGuard>
            <Dashboard>{children}</Dashboard>
          </SubscriptionGuard>
        </PermissionProvider>
      </OnboardingGuard>
    </Authenticated>
  );
}
