'use client';

import { useState } from 'react';
import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GitBranch, MoreVertical, Plus, CheckCircle, Clock, Target } from 'lucide-react';
import { RuleBuilder } from '@/components/features/rule-builder';

const rules = [
  {
    name: 'Ink Compatibility',
    description: 'Match ink cartridges to printer models',
    matches: '4,521',
    status: 'Active',
    accuracy: '98.2%',
  },
  {
    name: 'Paper Size Rules',
    description: 'Paper dimensions vs printer capabilities',
    matches: '2,890',
    status: 'Active',
    accuracy: '99.1%',
  },
  {
    name: 'Toner Matching',
    description: 'Toner units to laser printer series',
    matches: '1,756',
    status: 'Active',
    accuracy: '97.8%',
  },
  {
    name: 'Accessory Fit',
    description: 'Accessories to compatible devices',
    matches: '890',
    status: 'Draft',
    accuracy: '95.4%',
  },
  {
    name: 'Service Coverage',
    description: 'Service plans to product eligibility',
    matches: '320',
    status: 'Active',
    accuracy: '100%',
  },
  {
    name: 'Legacy Support',
    description: 'Legacy devices to current supplies',
    matches: '2,100',
    status: 'Review',
    accuracy: '89.2%',
  },
];

const stats = [
  { label: 'Total Rules', value: '12', icon: GitBranch, color: 'text-primary' },
  { label: 'Active Matches', value: '12.4K', icon: CheckCircle, color: 'text-emerald-600' },
  { label: 'Pending Review', value: '3', icon: Clock, color: 'text-amber-600' },
  { label: 'Avg Accuracy', value: '97.2%', icon: Target, color: 'text-blue-600' },
];

export default function RulesPage() {
  const [isRuleBuilderOpen, setIsRuleBuilderOpen] = useState(false);

  return (
    <>
      <PageShell
        title="Compatibility Rules"
        description="Define matching logic between sources and targets"
        footerText={`Viewing ${rules.length} rules`}
        headerActions={
          <Button className="gap-2" onClick={() => setIsRuleBuilderOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create Rule</span>
          </Button>
        }
      >
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <div key={index} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <p className="text-2xl font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Rules list */}
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {rules.map((rule, index) => (
              <div
                key={index}
                onClick={() => setIsRuleBuilderOpen(true)}
                className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <GitBranch className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{rule.name}</h3>
                    <p className="text-xs text-muted-foreground">{rule.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium">{rule.matches}</p>
                    <p className="text-xs text-muted-foreground">matches</p>
                  </div>
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-medium text-emerald-600">{rule.accuracy}</p>
                    <p className="text-xs text-muted-foreground">accuracy</p>
                  </div>
                  <Badge
                    variant={rule.status === 'Active' ? 'default' : rule.status === 'Draft' ? 'secondary' : 'outline'}
                    className="text-xs"
                  >
                    {rule.status}
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

      {isRuleBuilderOpen && <RuleBuilder onClose={() => setIsRuleBuilderOpen(false)} />}
    </>
  );
}
