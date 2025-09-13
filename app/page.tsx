'use client';

import { Authenticated, Unauthenticated, useMutation, useQuery, useConvexAuth } from 'convex/react';
import Link from 'next/link';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import type { User } from '@workos-inc/node';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { user, signOut } = useAuth();

  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        Convex + Next.js + WorkOS
        {user && <UserMenu user={user} onSignOut={signOut} />}
      </header>
      <main className="p-8 flex flex-col gap-8">
        <h1 className="text-4xl font-bold text-center">Convex + Next.js + WorkOS</h1>
        <Authenticated>
          <div>Authenticated</div>
        </Authenticated>
        <Unauthenticated>
          <SignInForm />
        </Unauthenticated>
      </main>
    </>
  );
}

function SignInForm() {
  return (
    <div className="flex flex-col gap-8 w-96 mx-auto">
      <p>Log in to see the numbers</p>
      <Link href="/sign-in">
        <Button className="bg-foreground text-background px-4 py-2 rounded-md">Sign in</Button>
      </Link>
      <Link href="/sign-up">
        <Button className="bg-foreground text-background px-4 py-2 rounded-md">Sign up</Button>
      </Link>
    </div>
  );
}

function ResourceCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <div className="flex flex-col gap-2 bg-slate-200 dark:bg-slate-800 p-4 rounded-md h-28 overflow-auto">
      <a href={href} className="text-sm underline hover:no-underline">
        {title}
      </a>
      <p className="text-xs">{description}</p>
    </div>
  );
}

function UserMenu({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{user.email}</span>
      <Button onClick={onSignOut} className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600">
        Sign out
      </Button>
    </div>
  );
}
