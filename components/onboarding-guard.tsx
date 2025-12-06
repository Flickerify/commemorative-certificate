'use client';

import { Spinner } from '@/components/ui/spinner';
import { api } from '@/convex/_generated/api';
import { useQuery, useAction } from 'convex/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

interface OnboardingGuardProps {
  children: ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useQuery(api.users.query.me);
  const completeOnboarding = useAction(api.users.action.completeOnboarding);

  const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);
  const [hasCompletedFromStripe, setHasCompletedFromStripe] = useState(false);

  const isOnboardingComplete = user?.metadata?.onboardingComplete === 'true';

  // Check if user is returning from Stripe checkout
  const isReturningFromStripe = searchParams.get('onboarding') === 'complete';
  const localeParam = searchParams.get('locale');

  // Complete onboarding when returning from Stripe checkout
  useEffect(() => {
    const completeOnboardingFromStripe = async () => {
      if (isReturningFromStripe && user && !isOnboardingComplete && !isCompletingOnboarding && !hasCompletedFromStripe) {
        setIsCompletingOnboarding(true);
        try {
          console.log('[OnboardingGuard] Completing onboarding after Stripe checkout');
          await completeOnboarding({
            preferredLocale: (localeParam as 'en' | 'de' | 'fr' | 'it' | 'rm') || 'en',
          });
          setHasCompletedFromStripe(true);
          // Remove the query params from the URL
          router.replace(window.location.pathname);
        } catch (error) {
          console.error('[OnboardingGuard] Failed to complete onboarding:', error);
        } finally {
          setIsCompletingOnboarding(false);
        }
      }
    };

    completeOnboardingFromStripe();
  }, [isReturningFromStripe, user, isOnboardingComplete, isCompletingOnboarding, hasCompletedFromStripe, completeOnboarding, localeParam, router]);

  // Redirect to onboarding if not complete and not currently completing from Stripe
  useEffect(() => {
    if (user !== undefined && !isOnboardingComplete && !isReturningFromStripe && !isCompletingOnboarding) {
      router.replace('/onboarding');
    }
  }, [user, isOnboardingComplete, isReturningFromStripe, isCompletingOnboarding, router]);

  // Loading state
  if (user === undefined || isCompletingOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // User not onboarded and not returning from Stripe - show loading while redirecting
  if (!isOnboardingComplete && !isReturningFromStripe) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // User is onboarded (or we just completed it), render children
  return <>{children}</>;
}

