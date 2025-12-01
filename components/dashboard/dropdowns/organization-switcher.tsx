'use client';

import { cn } from '@/lib/utils';
import { Building2, Check, ChevronDown, Plus, Settings, Users, UserPlus, Sparkles, User, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { Doc } from '@/convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

type Organization = Doc<'organizations'> & { role?: string };

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

const planColors: Record<string, string> = {
  free: 'bg-muted text-muted-foreground',
  personal: 'bg-muted text-muted-foreground',
  pro: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  enterprise: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
};

function OrgAvatar({
  name,
  logo,
  size = 'md',
  className,
  isPersonal = false,
}: {
  name: string;
  logo?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isPersonal?: boolean;
}) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-10 w-10 text-sm',
  };

  if (logo) {
    return <img src={logo} alt={name} className={cn('rounded-lg object-cover', sizeClasses[size], className)} />;
  }

  if (isPersonal) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-violet-600 text-white',
          sizeClasses[size],
          className,
        )}
      >
        <User className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg bg-linear-to-br from-primary to-primary/80 text-primary-foreground font-semibold',
        sizeClasses[size],
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}

export function OrganizationSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const { organizationId, switchToOrganization } = useAuth();

  // Fetch organizations from Convex
  const organizations = useQuery(api.organizations.query.getOrganizationsByUserId) as Organization[] | undefined;

  const handleSwitchToOrganization = async (orgExternalId: string) => {
    await switchToOrganization(orgExternalId);
    router.refresh();
  };

  // Loading state - show when data is loading OR when we have no organizations yet
  // This handles the race condition after onboarding where data might not be synced yet
  if (organizations === undefined) {
    return (
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-muted animate-pulse', className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If we have no organizations yet, show loading (data might still be syncing)
  if (organizations.length === 0) {
    return (
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-muted animate-pulse', className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Find current and personal organizations
  const currentOrg = organizations?.find((org) => org.externalId === organizationId);
  const personalOrg = organizations?.find((org) => org.metadata?.tier === 'personal');
  const nonPersonalOrgs = organizations?.filter((org) => org.metadata?.tier !== 'personal') || [];

  // If we have organizations but can't find the current one, use the first available
  // This handles the case where auth state is stale after org switch
  const effectiveCurrentOrg = currentOrg || organizations[0];

  const getPlanFromOrg = (org: Organization): string => {
    return (org.metadata?.tier as string) || 'personal';
  };

  const isEffectivePersonal = effectiveCurrentOrg?.metadata?.tier === 'personal';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg transition-all overflow-hidden',
            'hover:ring-2 hover:ring-primary/20 hover:ring-offset-2 hover:ring-offset-sidebar',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-sidebar',
            'relative group',
            className,
          )}
        >
          <OrgAvatar
            name={effectiveCurrentOrg.name}
            logo={effectiveCurrentOrg.metadata?.logoUrl as string | undefined}
            isPersonal={isEffectivePersonal}
            size="md"
          />
          <ChevronDown className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-sidebar text-sidebar-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" sideOffset={12} className="w-72 p-0 overflow-hidden">
        {/* Current Selection Header */}
        <div className="bg-muted/50 px-3 py-3 border-b">
          <div className="flex items-center gap-3">
            <OrgAvatar
              name={effectiveCurrentOrg.name}
              logo={effectiveCurrentOrg.metadata?.logoUrl as string | undefined}
              isPersonal={isEffectivePersonal}
              size="lg"
              className="shadow-sm"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{effectiveCurrentOrg.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{effectiveCurrentOrg.role || 'Member'}</p>
            </div>
            <span
              className={cn(
                'text-[10px] font-medium px-2 py-0.5 rounded-full capitalize',
                planColors[getPlanFromOrg(effectiveCurrentOrg)] || planColors.free,
              )}
            >
              {getPlanFromOrg(effectiveCurrentOrg)}
            </span>
          </div>
        </div>

        {/* Personal Workspace Option */}
        {personalOrg && (
          <DropdownMenuGroup className="p-1.5">
            <DropdownMenuItem
              onClick={() => handleSwitchToOrganization(personalOrg.externalId)}
              className={cn(
                'flex items-center gap-3 px-2 py-2.5 rounded-md cursor-pointer',
                isEffectivePersonal && 'bg-primary/5',
              )}
            >
              <OrgAvatar name="Personal" isPersonal size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Personal Workspace</p>
                <p className="text-xs text-muted-foreground">Your private space</p>
              </div>
              {isEffectivePersonal && <Check className="h-4 w-4 text-primary shrink-0" />}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        )}

        {/* Organizations List */}
        {nonPersonalOrgs.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-0" />
            <DropdownMenuGroup className="p-1.5">
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1.5">
                Organizations
              </DropdownMenuLabel>

              {nonPersonalOrgs.map((org) => {
                const isCurrentOrg = effectiveCurrentOrg.externalId === org.externalId;
                return (
                  <DropdownMenuItem
                    key={org._id}
                    onClick={() => handleSwitchToOrganization(org.externalId)}
                    className={cn(
                      'flex items-center gap-3 px-2 py-2.5 rounded-md cursor-pointer',
                      isCurrentOrg && 'bg-primary/5',
                    )}
                  >
                    <OrgAvatar
                      name={org.name}
                      logo={org.metadata?.logoUrl as string | undefined}
                      size="sm"
                      className="bg-linear-to-br from-muted to-muted/50 text-foreground"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{org.name}</p>
                        <span
                          className={cn(
                            'text-[9px] font-medium px-1.5 py-0.5 rounded capitalize',
                            planColors[getPlanFromOrg(org)] || planColors.free,
                          )}
                        >
                          {getPlanFromOrg(org)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground capitalize">{org.role || 'Member'}</p>
                    </div>
                    {isCurrentOrg && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator className="my-0" />

        {/* Create Organization */}
        <DropdownMenuGroup className="p-1.5">
          <DropdownMenuItem
            className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer"
            onClick={() => router.push('/organization/new')}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
              <Plus className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-sm">Create organization</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {/* Organization Management Options */}
        {!isEffectivePersonal && (
          <>
            <DropdownMenuSeparator className="my-0" />
            <DropdownMenuGroup className="p-1.5">
              <DropdownMenuItem
                className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer"
                onClick={() => router.push('/collaborators')}
              >
                <UserPlus className="h-4 w-4 text-muted-foreground ml-2" />
                <span className="text-sm">Invite members</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer"
                onClick={() => router.push('/collaborators')}
              >
                <Users className="h-4 w-4 text-muted-foreground ml-2" />
                <span className="text-sm">Manage members</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer"
                onClick={() => router.push('/administration/organization')}
              >
                <Settings className="h-4 w-4 text-muted-foreground ml-2" />
                <span className="text-sm">Organization settings</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        {/* Upgrade CTA */}
        {!isEffectivePersonal && getPlanFromOrg(effectiveCurrentOrg) !== 'enterprise' && (
          <>
            <DropdownMenuSeparator className="my-0" />
            <div
              className="p-3 bg-linear-to-r from-primary/5 to-primary/10 cursor-pointer hover:from-primary/10 hover:to-primary/15 transition-colors"
              onClick={() => router.push('/billing')}
            >
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Upgrade to Enterprise</span>
              </div>
              <p className="text-xs text-muted-foreground">Unlock unlimited certificates and priority support</p>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
