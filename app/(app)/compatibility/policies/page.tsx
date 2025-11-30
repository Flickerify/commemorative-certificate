'use client';

import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { FileCheck, Plus } from 'lucide-react';

export default function PoliciesPage() {
  return (
    <PageShell
      title="Policies"
      description="Configure compatibility policies"
      headerActions={
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create Policy</span>
        </Button>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mb-6 mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <FileCheck className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Policies</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Define policies to control how compatibility rules are applied and enforced.
          </p>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Policy
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
