'use client';

import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { CloudUpload, Plus } from 'lucide-react';

export default function PublishLogsPage() {
  return (
    <PageShell
      title="Publish Logs"
      description="View deployment history"
      headerActions={
        <Button className="gap-2">
          <CloudUpload className="h-4 w-4" />
          <span className="hidden sm:inline">Publish Now</span>
        </Button>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mb-6 mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <CloudUpload className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Publish Logs</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Track all publish events and deployment history for your compatibility data.
          </p>
          <Button className="gap-2">
            <CloudUpload className="h-4 w-4" />
            Publish Now
          </Button>
        </div>
      </div>
    </PageShell>
  );
}

