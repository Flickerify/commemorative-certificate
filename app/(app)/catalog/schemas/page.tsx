'use client';

import { useState } from 'react';
import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileCode, MoreVertical, Plus } from 'lucide-react';
import { SchemaBuilder } from '@/components/features/schema-builder';

const schemas = [
  { name: 'Vehicle Schema', fields: 12, records: '12,450', status: 'Active' },
  { name: 'Product Schema', fields: 8, records: '3,200', status: 'Active' },
  { name: 'Accessory Schema', fields: 6, records: '890', status: 'Draft' },
];

export default function SchemasPage() {
  const [isSchemaBuilderOpen, setIsSchemaBuilderOpen] = useState(false);

  return (
    <>
      <PageShell
        title="Schemas"
        description="Define your data schemas"
        footerText={`Viewing ${schemas.length} schemas`}
        headerActions={
          <Button className="gap-2" onClick={() => setIsSchemaBuilderOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create Schema</span>
          </Button>
        }
      >
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {schemas.map((schema, index) => (
              <div
                key={index}
                onClick={() => setIsSchemaBuilderOpen(true)}
                className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <FileCode className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{schema.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {schema.fields} fields · {schema.records} records
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={schema.status === 'Active' ? 'default' : 'secondary'} className="text-xs">
                    {schema.status}
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

      {isSchemaBuilderOpen && <SchemaBuilder onClose={() => setIsSchemaBuilderOpen(false)} />}
    </>
  );
}

