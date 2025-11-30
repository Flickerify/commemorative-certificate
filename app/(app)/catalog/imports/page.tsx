'use client';

import { useState } from 'react';
import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, MoreVertical } from 'lucide-react';
import { ImportWizard } from '@/components/features/import-wizard';

const imports = [
  { name: 'vehicles_2024.csv', status: 'Completed', records: '5,420', date: 'Nov 28, 2025' },
  { name: 'products_update.json', status: 'Completed', records: '1,200', date: 'Nov 25, 2025' },
  { name: 'legacy_data.csv', status: 'Failed', records: '0', date: 'Nov 20, 2025' },
];

export default function ImportsPage() {
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  return (
    <>
      <PageShell
        title="Imports"
        description="View and manage data imports"
        footerText={`Viewing ${imports.length} imports`}
        headerActions={
          <Button className="gap-2" onClick={() => setIsImportWizardOpen(true)}>
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Start Import</span>
          </Button>
        }
      >
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {imports.map((imp, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Upload className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{imp.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {imp.records} records · {imp.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={imp.status === 'Completed' ? 'default' : 'destructive'} className="text-xs">
                    {imp.status}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageShell>

      {isImportWizardOpen && <ImportWizard onClose={() => setIsImportWizardOpen(false)} />}
    </>
  );
}
