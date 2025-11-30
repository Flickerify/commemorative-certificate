'use client';

import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Activity, Download } from 'lucide-react';

export default function AuditPage() {
  return (
    <PageShell
      title="Audit Logs"
      description="Track activity and changes"
      headerActions={
        <Button variant="outline" className="gap-2 bg-transparent">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mb-6 mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Activity className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Audit Logs</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Monitor all activity and changes made within your organization.
          </p>
          <Button variant="outline" className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            Export Logs
          </Button>
        </div>
      </div>
    </PageShell>
  );
}

