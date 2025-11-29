'use client';

import { UserProvider } from '@/components/user-provider';
import type { ReactNode } from 'react';

export default function OnboardingLayout({ children }: { readonly children: ReactNode }) {
  return (
    <UserProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {children}
      </div>
    </UserProvider>
  );
}
