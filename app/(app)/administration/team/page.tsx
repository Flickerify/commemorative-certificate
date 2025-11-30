'use client';

import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreVertical, Plus, UserPlus } from 'lucide-react';

const members = [
  { name: 'John Doe', email: 'john@company.com', role: 'Admin', status: 'Active' },
  { name: 'Jane Smith', email: 'jane@company.com', role: 'Editor', status: 'Active' },
  { name: 'Bob Wilson', email: 'bob@company.com', role: 'Viewer', status: 'Active' },
  { name: 'Alice Brown', email: 'alice@company.com', role: 'Editor', status: 'Pending' },
];

export default function TeamPage() {
  return (
    <PageShell
      title="Team Members"
      description="Manage your team"
      footerText={`Viewing ${members.length} members`}
      headerActions={
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Invite Member</span>
        </Button>
      }
    >
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {members.map((member, index) => (
          <div key={index} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">
                  {member.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                {member.role}
              </Badge>
              <Badge variant={member.status === 'Active' ? 'default' : 'secondary'} className="text-xs">
                {member.status}
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

