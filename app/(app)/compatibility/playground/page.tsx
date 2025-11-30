'use client';

import { useState } from 'react';
import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Database, Target, Play, Eye } from 'lucide-react';
import { PublicPagePreview } from '@/components/features/public-page-preview';

export default function PlaygroundPage() {
  const [isPublicPreviewOpen, setIsPublicPreviewOpen] = useState(false);

  return (
    <>
      <PageShell
        title="Test Playground"
        description="Test compatibility between items"
        headerActions={
          <Button variant="outline" className="gap-2 bg-transparent" onClick={() => setIsPublicPreviewOpen(true)}>
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Preview Page</span>
          </Button>
        }
      >
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Test Compatibility</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Source Item</label>
                <div className="rounded-lg border border-dashed border-border p-8 text-center bg-muted/30">
                  <Database className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Select or drag a source item</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Target Item</label>
                <div className="rounded-lg border border-dashed border-border p-8 text-center bg-muted/30">
                  <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Select or drag a target item</p>
                </div>
              </div>
            </div>
            <div className="flex justify-center mt-6 gap-3">
              <Button className="gap-2">
                <Play className="h-4 w-4" />
                Run Compatibility Test
              </Button>
              <Button variant="outline" className="gap-2 bg-transparent" onClick={() => setIsPublicPreviewOpen(true)}>
                Preview Public Page
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Recent Tests</h3>
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No tests run yet. Select items above to test compatibility.</p>
            </div>
          </div>
        </div>
      </PageShell>

      {isPublicPreviewOpen && <PublicPagePreview onClose={() => setIsPublicPreviewOpen(false)} />}
    </>
  );
}

