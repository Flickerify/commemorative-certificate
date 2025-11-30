'use client';

import { useState } from 'react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MoreVertical, UserPlus, Loader2, Mail, Shield, Trash2, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';

const roleColors: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  member: 'bg-muted text-muted-foreground',
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  inactive: 'bg-muted text-muted-foreground',
};

export default function TeamPage() {
  const { organizationId } = useAuth();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Fetch members
  const members = useQuery(
    api.organizations.query.getMembers,
    organizationId ? { organizationId } : 'skip'
  );
  
  const isAdmin = useQuery(
    api.organizations.query.isAdmin,
    organizationId ? { organizationId } : 'skip'
  );

  // Actions
  const inviteMember = useAction(api.organizations.action.inviteMember);
  const removeMember = useAction(api.organizations.action.removeMember);
  const updateMemberRole = useAction(api.organizations.action.updateMemberRole);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    setInviteError(null);
    setIsInviting(true);

    try {
      await inviteMember({
        organizationId,
        email: inviteEmail,
        roleSlug: inviteRole,
      });
      setIsInviteOpen(false);
      setInviteEmail('');
      setInviteRole('member');
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!organizationId) return;
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      await removeMember({ organizationId, userId });
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  const handleUpdateRole = async (userId: string, roleSlug: string) => {
    if (!organizationId) return;

    try {
      await updateMemberRole({ organizationId, userId, roleSlug });
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const isLoading = members === undefined;

  return (
    <>
      <PageShell
        title="Team Members"
        description="Manage your team and their permissions"
        footerText={members ? `Viewing ${members.length} members` : undefined}
        headerActions={
          isAdmin && (
            <Button className="gap-2" onClick={() => setIsInviteOpen(true)}>
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Invite Member</span>
            </Button>
          )
        }
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : members && members.length > 0 ? (
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {members.map((member) => (
              <div key={member._id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {member.user?.profilePictureUrl ? (
                    <img
                      src={member.user.profilePictureUrl}
                      alt={`${member.user.firstName || ''} ${member.user.lastName || ''}`}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {member.user?.firstName?.[0] || member.user?.email?.[0]?.toUpperCase() || '?'}
                        {member.user?.lastName?.[0] || ''}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {member.user?.firstName && member.user?.lastName
                        ? `${member.user.firstName} ${member.user.lastName}`
                        : member.user?.email || 'Unknown User'}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={cn('text-xs capitalize', roleColors[member.role || 'member'])}>
                    {member.role || 'member'}
                  </Badge>
                  <Badge className={cn('text-xs capitalize', statusColors[member.status])}>
                    {member.status}
                  </Badge>
                  {isAdmin && member.role !== 'owner' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleUpdateRole(member.userId, 'admin')}>
                          <Shield className="h-4 w-4 mr-2" />
                          Make Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateRole(member.userId, 'member')}>
                          <UserCog className="h-4 w-4 mr-2" />
                          Make Member
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleRemoveMember(member.userId)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md text-center">
              <div className="mb-6 mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <UserPlus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold mb-2">No Team Members Yet</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Invite your team members to collaborate on your organization.
              </p>
              {isAdmin && (
                <Button className="gap-2" onClick={() => setIsInviteOpen(true)}>
                  <UserPlus className="h-4 w-4" />
                  Invite Member
                </Button>
              )}
            </div>
          </div>
        )}
      </PageShell>

      {/* Invite Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation email to add a new member to your organization.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={isInviting}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole} disabled={isInviting}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Admins can manage team members and organization settings.
              </p>
            </div>
            {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)} disabled={isInviting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isInviting || !inviteEmail} className="gap-2">
                {isInviting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Send Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
