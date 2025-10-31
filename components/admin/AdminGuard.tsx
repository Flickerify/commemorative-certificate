'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * Component that protects admin routes by checking if user is admin
 */
export function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const isAdmin = useQuery(api.users.admin.isAdmin);

  useEffect(() => {
    if (isAdmin === false) {
      // User is not admin, redirect to home
      router.push('/');
    }
  }, [isAdmin, router]);

  // Show loading or nothing while checking
  if (isAdmin === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // If not admin, don't render children (redirect will happen)
  if (isAdmin === false) {
    return null;
  }

  return <>{children}</>;
}
