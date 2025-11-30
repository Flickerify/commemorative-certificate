'use client';

import { UserProvider } from '@/components/user-provider';
import { Authenticated } from 'convex/react';
import type { ReactNode } from 'react';

export default function OnboardingLayout({ children }: { readonly children: ReactNode }) {
  return (
    <Authenticated>
      <UserProvider>
        <div className="min-h-screen bg-background">
          {/* Subtle background pattern */}
          <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,oklch(0.6_0.15_250/0.15),transparent)]" />
          {children}
        </div>
      </UserProvider>
    </Authenticated>
  );
}
