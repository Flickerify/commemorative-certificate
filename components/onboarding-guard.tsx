'use client';

import { Spinner } from '@/components/ui/spinner';
import { api } from '@/convex/_generated/api';
import { useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

interface OnboardingGuardProps {
  children: ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const router = useRouter();
  const user = useQuery(api.users.query.me);

  const isOnboardingComplete = user?.metadata?.onboardingComplete === true;

  useEffect(() => {
    // Only redirect if we have user data and onboarding is not complete
    if (user !== undefined && !isOnboardingComplete) {
      router.replace('/onboarding');
    }
  }, [user, isOnboardingComplete, router]);

  // Loading state
  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // User not onboarded - show loading while redirecting
  if (!isOnboardingComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // User is onboarded, render children
  return <>{children}</>;
}

