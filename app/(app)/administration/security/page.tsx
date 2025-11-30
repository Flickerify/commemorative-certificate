'use client';

import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Shield, Settings } from 'lucide-react';

export default function SecurityPage() {
  return (
    <PageShell
      title="Security Settings"
      description="Configure security options"
      headerActions={
        <Button variant="outline" className="gap-2 bg-transparent">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Configure</span>
        </Button>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mb-6 mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Security Settings</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Configure two-factor authentication, session management, and other security options.
          </p>
          <Button className="gap-2">
            <Shield className="h-4 w-4" />
            Configure Security
          </Button>
        </div>
      </div>
    </PageShell>
  );
}

