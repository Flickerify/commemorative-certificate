'use client';

import { OnboardingGuard } from '@/components/onboarding-guard';
import Dashboard from '@/components/dashboard/dashboard';
import { Authenticated } from 'convex/react';
import type { ReactNode } from 'react';

export default function AuthenticatedLayout({ children }: { readonly children: ReactNode }) {
  return (
    <Authenticated>
      <OnboardingGuard>
        <Dashboard>{children}</Dashboard>
      </OnboardingGuard>
    </Authenticated>
  );
}
