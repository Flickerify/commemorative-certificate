'use client';

import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { UserCog, Plus } from 'lucide-react';

export default function RolesPage() {
  return (
    <PageShell
      title="Roles & Permissions"
      description="Configure access control"
      headerActions={
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create Role</span>
        </Button>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mb-6 mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <UserCog className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Roles & Permissions</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Define custom roles and granular permissions for your team members.
          </p>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Role
          </Button>
        </div>
      </div>
    </PageShell>
  );
}

