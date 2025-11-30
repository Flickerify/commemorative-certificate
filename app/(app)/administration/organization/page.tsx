'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Building2, Settings, Loader2, Users, Calendar, Globe, Shield, Trash2, Pencil, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const planConfig: Record<string, { label: string; color: string; features: string[] }> = {
  personal: {
    label: 'Personal',
    color: 'bg-muted text-muted-foreground',
    features: ['1 member', 'Basic features', 'Community support'],
  },
  free: {
    label: 'Free',
    color: 'bg-muted text-muted-foreground',
    features: ['Up to 5 members', 'Basic features', 'Community support'],
  },
  pro: {
    label: 'Pro',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    features: ['Up to 20 members', 'Advanced features', 'Priority support'],
  },
  enterprise: {
    label: 'Enterprise',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    features: ['Unlimited members', 'All features', 'Dedicated support'],
  },
};

export default function OrganizationPage() {
  const router = useRouter();
  const { organizationId } = useAuth();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch organization details
  const organization = useQuery(api.organizations.query.getCurrent, organizationId ? { organizationId } : 'skip');

  const isAdmin = useQuery(api.organizations.query.isAdmin, organizationId ? { organizationId } : 'skip');

  // Actions
  const updateOrganization = useAction(api.organizations.action.update);
  const deleteOrganization = useAction(api.organizations.action.remove);

  const handleEdit = () => {
    if (organization) {
      setEditName(organization.name);
      setIsEditOpen(true);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !editName.trim()) return;

    setIsUpdating(true);
    try {
      await updateOrganization({
        organizationId,
        name: editName.trim(),
      });
      setIsEditOpen(false);
    } catch (err) {
      console.error('Failed to update organization:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!organizationId) return;

    setIsDeleting(true);
    try {
      await deleteOrganization({ organizationId });
      router.push('/catalog/sources');
      router.refresh();
    } catch (err) {
      console.error('Failed to delete organization:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const isLoading = organization === undefined;
  const plan = (organization?.metadata?.tier as string) || 'free';
  const planInfo = planConfig[plan] || planConfig.free;
  const isPersonal = plan === 'personal';

  return (
    <>
      <PageShell
        title="Organization Settings"
        description="Manage your organization details and settings"
        headerActions={
          isAdmin &&
          !isPersonal && (
            <Button variant="outline" className="gap-2 bg-transparent" onClick={handleEdit}>
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          )
        }
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : organization ? (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Organization Info Card */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-16 w-16 rounded-xl bg-linear-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-bold text-xl">
                  {organization.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{organization.name}</h3>
                  <Badge className={cn('text-xs capitalize', planInfo.color)}>{planInfo.label} Plan</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Shield className="h-4 w-4" />
                    <span>Organization ID</span>
                  </div>
                  <p className="text-sm font-medium font-mono truncate">{organization.externalId}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    <span>Created</span>
                  </div>
                  <p className="text-sm font-medium">
                    {new Date(organization._creationTime).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Users className="h-4 w-4" />
                    <span>Team Members</span>
                  </div>
                  <p className="text-sm font-medium">{organization.memberCount} members</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Globe className="h-4 w-4" />
                    <span>Domains</span>
                  </div>
                  <p className="text-sm font-medium">
                    {organization.domains?.length
                      ? organization.domains.map((d) => d.domain).join(', ')
                      : 'No verified domains'}
                  </p>
                </div>
              </div>
            </div>

            {/* Plan Features */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Current Plan</h3>
                <Badge className={cn('text-xs capitalize', planInfo.color)}>{planInfo.label}</Badge>
              </div>
              <ul className="space-y-2 mb-6">
                {planInfo.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              {plan !== 'enterprise' && !isPersonal && (
                <Button className="w-full gap-2" onClick={() => router.push('/billing')}>
                  <Sparkles className="h-4 w-4" />
                  Upgrade Plan
                </Button>
              )}
            </div>

            {/* Danger Zone */}
            {isAdmin && !isPersonal && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6">
                <h3 className="font-semibold text-destructive mb-2">Danger Zone</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Once you delete an organization, there is no going back. All data will be permanently removed.
                </p>
                <Button variant="destructive" className="gap-2" onClick={() => setIsDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4" />
                  Delete Organization
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md text-center">
              <div className="mb-6 mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold mb-2">No Organization Selected</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Select an organization from the sidebar to view its settings.
              </p>
            </div>
          </div>
        )}
      </PageShell>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>Update your organization details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Organization Name</Label>
              <Input
                id="edit-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={isUpdating}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating || !editName.trim()} className="gap-2">
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{' '}
              <span className="font-semibold">{organization?.name}</span> and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Organization
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
