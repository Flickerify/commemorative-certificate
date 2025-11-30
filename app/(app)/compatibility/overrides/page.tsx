'use client';

import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { AlertOctagon, Plus } from 'lucide-react';

export default function OverridesPage() {
  return (
    <PageShell
      title="Overrides"
      description="Manage compatibility overrides"
      headerActions={
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create Override</span>
        </Button>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mb-6 mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <AlertOctagon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Overrides</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Create manual overrides to adjust compatibility results for specific items.
          </p>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Override
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
