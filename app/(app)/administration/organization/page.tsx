'use client';

import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Building2, Settings } from 'lucide-react';

export default function OrganizationPage() {
  return (
    <PageShell
      title="Organization Settings"
      description="Manage your organization"
      headerActions={
        <Button variant="outline" className="gap-2 bg-transparent">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Edit</span>
        </Button>
      }
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Acme Corporation</h3>
              <p className="text-sm text-muted-foreground">Enterprise Plan</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Organization ID</label>
              <p className="text-sm font-medium font-mono">org_2f8k9p3x</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Created</label>
              <p className="text-sm font-medium">Jan 15, 2025</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Team Members</label>
              <p className="text-sm font-medium">12 members</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">API Calls</label>
              <p className="text-sm font-medium">8.2K this month</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Danger Zone</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Once you delete an organization, there is no going back. Please be certain.
          </p>
          <Button variant="destructive">Delete Organization</Button>
        </div>
      </div>
    </PageShell>
  );
}

