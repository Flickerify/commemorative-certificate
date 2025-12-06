'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';

export default function AccountPage() {
  const router = useRouter();

  // Client-side redirect to allow OnboardingGuard to run first
  useEffect(() => {
    router.replace('/account/profile');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}
