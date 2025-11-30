'use client';

import { useState } from 'react';
import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, MoreVertical, Plus, Upload } from 'lucide-react';
import { ImportWizard } from '@/components/features/import-wizard';

const sources = [
  { name: 'Vehicle Database', type: 'PostgreSQL', records: '12,450', status: 'Active', lastSync: '2 min ago' },
  { name: 'Printer Catalog', type: 'REST API', records: '3,200', status: 'Active', lastSync: '5 min ago' },
  { name: 'Accessory Inventory', type: 'CSV Import', records: '890', status: 'Active', lastSync: '1 hour ago' },
  { name: 'Legacy Products', type: 'MySQL', records: '5,670', status: 'Syncing', lastSync: 'In progress' },
  { name: 'Partner Feed', type: 'Webhook', records: '2,100', status: 'Active', lastSync: '15 min ago' },
  { name: 'Test Dataset', type: 'JSON', records: '150', status: 'Inactive', lastSync: '3 days ago' },
];

export default function SourcesPage() {
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  return (
    <>
      <PageShell
        title="Sources"
        description="Manage your data sources"
        footerText={`Viewing ${sources.length} sources`}
        headerActions={
          <>
            <Button variant="outline" className="gap-2 bg-transparent" onClick={() => setIsImportWizardOpen(true)}>
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Source</span>
            </Button>
          </>
        }
      >
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {sources.map((source, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{source.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {source.type} · {source.records} records
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground hidden sm:inline">{source.lastSync}</span>
                <Badge
                  variant={source.status === 'Active' ? 'default' : source.status === 'Syncing' ? 'secondary' : 'outline'}
                  className="text-xs"
                >
                  {source.status}
                </Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PageShell>

      {isImportWizardOpen && <ImportWizard onClose={() => setIsImportWizardOpen(false)} />}
    </>
  );
}

