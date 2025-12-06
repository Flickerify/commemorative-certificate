'use client';

import { Spinner } from '@/components/ui/spinner';
import { api } from '@/convex/_generated/api';
import { useQuery } from 'convex/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';

interface OnboardingGuardProps {
  children: ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useQuery(api.users.query.me);

  // Use ref to track if we've started cleaning params (avoids setState in effect)
  const isCleaningParamsRef = useRef(false);

  const isOnboardingComplete = user?.metadata?.onboardingComplete === true;

  // Check if user just completed onboarding (free trial flow)
  // The onboarding page calls completeOnboarding() directly, then redirects with ?onboarding=complete
  const justCompletedOnboarding = searchParams.get('onboarding') === 'complete';

  // Clean up URL params ONLY after we confirm onboarding is complete in the database
  // This prevents a race condition where the URL is cleaned before the query updates
  useEffect(() => {
    if (justCompletedOnboarding && isOnboardingComplete && !isCleaningParamsRef.current) {
      isCleaningParamsRef.current = true;
      // Now safe to clean the URL - the database confirms onboarding is complete
      router.replace(window.location.pathname);
    }
  }, [justCompletedOnboarding, isOnboardingComplete, router]);

  // Redirect to onboarding if not complete AND not just completing
  useEffect(() => {
    if (user !== undefined && !isOnboardingComplete && !justCompletedOnboarding) {
      router.replace('/onboarding');
    }
  }, [user, isOnboardingComplete, justCompletedOnboarding, router]);

  // Loading state
  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // User not onboarded and not just completing - show loading while redirecting
  if (!isOnboardingComplete && !justCompletedOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // User is onboarded (or just completed), render children
  return <>{children}</>;
}
