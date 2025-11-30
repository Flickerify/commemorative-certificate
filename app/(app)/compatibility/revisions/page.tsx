'use client';

import { useState } from 'react';
import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Layers, MoreVertical } from 'lucide-react';
import { RevisionHistory } from '@/components/features/revision-history';

const revisions = [
  { version: 'v2.4.0', date: 'Nov 28, 2025', author: 'John Doe', status: 'Published', changes: 12 },
  { version: 'v2.3.1', date: 'Nov 25, 2025', author: 'Jane Smith', status: 'Published', changes: 5 },
  { version: 'v2.3.0', date: 'Nov 20, 2025', author: 'John Doe', status: 'Published', changes: 23 },
  { version: 'v2.2.0', date: 'Nov 15, 2025', author: 'Bob Wilson', status: 'Published', changes: 18 },
];

export default function RevisionsPage() {
  const [isRevisionHistoryOpen, setIsRevisionHistoryOpen] = useState(false);

  return (
    <>
      <PageShell
        title="Revisions"
        description="View and manage version history"
        footerText={`Viewing ${revisions.length} revisions`}
        headerActions={
          <Button variant="outline" className="gap-2 bg-transparent" onClick={() => setIsRevisionHistoryOpen(true)}>
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">View History</span>
          </Button>
        }
      >
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {revisions.map((rev, index) => (
              <div
                key={index}
                onClick={() => setIsRevisionHistoryOpen(true)}
                className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    <Layers className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{rev.version}</h3>
                    <p className="text-xs text-muted-foreground">
                      {rev.author} · {rev.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{rev.changes} changes</span>
                  <Badge variant="default" className="text-xs">
                    {rev.status}
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

      {isRevisionHistoryOpen && <RevisionHistory onClose={() => setIsRevisionHistoryOpen(false)} />}
    </>
  );
}

