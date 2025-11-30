'use client';

import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Key, Plus } from 'lucide-react';

export default function ApiKeysPage() {
  return (
    <PageShell
      title="API Keys"
      description="Manage API access"
      headerActions={
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create Key</span>
        </Button>
      }
    >
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mb-6 mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Key className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">API Keys</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Generate and manage API keys for programmatic access to your compatibility data.
          </p>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create API Key
          </Button>
        </div>
      </div>
    </PageShell>
  );
}

