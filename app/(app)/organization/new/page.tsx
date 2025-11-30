'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Loader2, ArrowLeft, Sparkles, Users, Shield, Zap } from 'lucide-react';

export default function NewOrganizationPage() {
  const router = useRouter();
  const createOrganization = useAction(api.organizations.action.create);

  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Organization name is required');
      return;
    }

    try {
      setIsLoading(true);
      const result = await createOrganization({ name: name.trim() });
      
      // Redirect to the new organization's settings
      router.push('/administration/organization');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageShell
      title="Create Organization"
      description="Set up a new organization for your team"
      headerActions={
        <Button variant="ghost" className="gap-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>
      }
    >
      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Organization Preview Card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="h-16 w-16 rounded-xl bg-linear-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-bold text-xl">
                {name ? name.charAt(0).toUpperCase() : 'O'}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{name || 'Your Organization'}</h3>
                <p className="text-sm text-muted-foreground">Free Plan</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Acme Corporation"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-base"
                  disabled={isLoading}
                  autoFocus
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                icon: Users,
                title: 'Team Collaboration',
                description: 'Invite team members and assign roles',
              },
              {
                icon: Shield,
                title: 'Access Control',
                description: 'Manage permissions and security settings',
              },
              {
                icon: Zap,
                title: 'Shared Resources',
                description: 'Share templates, certificates, and data',
              },
              {
                icon: Sparkles,
                title: 'Upgrade Anytime',
                description: 'Scale to Pro or Enterprise when needed',
              },
            ].map((feature, index) => (
              <div key={index} className="rounded-lg border border-border bg-card/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <feature.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{feature.title}</p>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()} className="gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4" />
                  Create Organization
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </PageShell>
  );
}

