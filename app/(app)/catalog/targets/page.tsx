'use client';

import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, MoreVertical, Plus } from 'lucide-react';

const targets = [
  { name: 'Ink Cartridges', type: 'Product Category', items: '450', status: 'Active' },
  { name: 'Toner Units', type: 'Product Category', items: '320', status: 'Active' },
  { name: 'Paper Types', type: 'Consumable', items: '85', status: 'Active' },
  { name: 'Printer Models', type: 'Hardware', items: '1,200', status: 'Active' },
  { name: 'Accessories', type: 'Add-on', items: '560', status: 'Draft' },
  { name: 'Service Plans', type: 'Subscription', items: '12', status: 'Active' },
  { name: 'Legacy Devices', type: 'Deprecated', items: '890', status: 'Archived' },
  { name: 'Beta Products', type: 'Testing', items: '45', status: 'Draft' },
];

export default function TargetsPage() {
  return (
    <PageShell
      title="Targets"
      description="Manage your target definitions"
      footerText={`Viewing ${targets.length} targets`}
      headerActions={
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Target</span>
        </Button>
      }
    >
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {targets.map((target, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-medium text-sm">{target.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {target.type} · {target.items} items
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant={target.status === 'Active' ? 'default' : target.status === 'Draft' ? 'secondary' : 'outline'}
                className="text-xs"
              >
                {target.status}
              </Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

