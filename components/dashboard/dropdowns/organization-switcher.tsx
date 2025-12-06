'use client';

import { cn } from '@/lib/utils';
import { Check, ChevronDown, Plus, Settings, Users, UserPlus, Sparkles, User, Loader2, Lock } from 'lucide-react';
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
import Image from 'next/image';

type Organization = Doc<'organizations'> & {
  roleSlug?: string;
  subscriptionTier?: string;
  hasActiveSubscription?: boolean;
};

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
    return <Image src={logo} alt={name} className={cn('rounded-lg object-cover', sizeClasses[size], className)} />;
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

  // Fetch organizations from Convex (includes subscriptionTier from source of truth)
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

  // Find current org or use the first available
  const currentOrg = organizations?.find((org) => org.externalId === organizationId);
  const effectiveCurrentOrg = currentOrg || organizations[0];

  // Helper to get tier from subscription (source of truth)
  const getTier = (org: Organization): string => org.subscriptionTier || 'personal';

  // Helper to check if org is personal tier
  const isOrgPersonal = (org: Organization): boolean => getTier(org) === 'personal';

  const isEffectivePersonal = isOrgPersonal(effectiveCurrentOrg);

  // Categorize organizations by subscription tier
  const personalOrgs = organizations?.filter((org) => isOrgPersonal(org)) ?? [];
  const teamOrgs = organizations?.filter((org) => !isOrgPersonal(org)) ?? [];

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
              <p className="text-xs text-muted-foreground capitalize">{effectiveCurrentOrg.roleSlug || 'Member'}</p>
            </div>
            <span
              className={cn(
                'text-[10px] font-medium px-2 py-0.5 rounded-full capitalize',
                planColors[getTier(effectiveCurrentOrg)] || planColors.free,
              )}
            >
              {getTier(effectiveCurrentOrg)}
            </span>
          </div>
        </div>

        {/* All Organizations List */}
        <DropdownMenuGroup className="p-1.5">
          {/* Personal Organizations */}
          {personalOrgs.length > 0 && (
            <>
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1.5">
                Personal
              </DropdownMenuLabel>
              {personalOrgs.map((org) => {
                const isCurrentOrg = effectiveCurrentOrg.externalId === org.externalId;
                const plan = getTier(org);
                return (
                  <DropdownMenuItem
                    key={org._id}
                    onClick={() => handleSwitchToOrganization(org.externalId)}
                    className={cn(
                      'flex items-center gap-3 px-2 py-2.5 rounded-md cursor-pointer',
                      isCurrentOrg && 'bg-primary/5',
                    )}
                  >
                    <OrgAvatar name={org.name} isPersonal={isOrgPersonal(org)} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{org.name}</p>
                        <span
                          className={cn(
                            'text-[9px] font-medium px-1.5 py-0.5 rounded capitalize',
                            planColors[plan] || planColors.personal,
                          )}
                        >
                          {plan}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground capitalize">{org.roleSlug || 'Owner'}</p>
                    </div>
                    {isCurrentOrg && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
            </>
          )}

          {/* Team Organizations */}
          {teamOrgs.length > 0 && (
            <>
              {personalOrgs.length > 0 && <DropdownMenuSeparator className="my-1" />}
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1.5">
                Teams
              </DropdownMenuLabel>
              {teamOrgs.map((org) => {
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
                            planColors[getTier(org)] || planColors.free,
                          )}
                        >
                          {getTier(org)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground capitalize">{org.roleSlug || 'Member'}</p>
                    </div>
                    {isCurrentOrg && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
            </>
          )}
        </DropdownMenuGroup>

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
        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuGroup className="p-1.5">
          {isEffectivePersonal ? (
            // Personal tier - show options with "Pro+ only" indicator
            <>
              <DropdownMenuItem
                className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer opacity-60"
                onClick={() => router.push('/administration/billing')}
              >
                <UserPlus className="h-4 w-4 text-muted-foreground ml-2" />
                <span className="text-sm flex-1">Invite members</span>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Pro+
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer opacity-60"
                onClick={() => router.push('/administration/billing')}
              >
                <Users className="h-4 w-4 text-muted-foreground ml-2" />
                <span className="text-sm flex-1">Manage members</span>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Pro+
                </span>
              </DropdownMenuItem>
            </>
          ) : (
            // Pro/Enterprise - show normal options
            <>
              <DropdownMenuItem
                className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer"
                onClick={() => router.push('/administration/team')}
              >
                <UserPlus className="h-4 w-4 text-muted-foreground ml-2" />
                <span className="text-sm">Invite members</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer"
                onClick={() => router.push('/administration/team')}
              >
                <Users className="h-4 w-4 text-muted-foreground ml-2" />
                <span className="text-sm">Manage members</span>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem
            className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer"
            onClick={() => router.push('/administration/organization')}
          >
            <Settings className="h-4 w-4 text-muted-foreground ml-2" />
            <span className="text-sm">Organization settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {/* Upgrade CTA - contextual based on current plan */}
        {getTier(effectiveCurrentOrg) !== 'enterprise' && (
          <>
            <DropdownMenuSeparator className="my-0" />
            <div
              className="p-3 bg-linear-to-r from-primary/5 to-primary/10 cursor-pointer hover:from-primary/10 hover:to-primary/15 transition-colors"
              onClick={() => router.push('/administration/billing')}
            >
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {isEffectivePersonal ? 'Upgrade to Pro' : 'Upgrade to Enterprise'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isEffectivePersonal
                  ? 'Invite team members and unlock advanced features'
                  : 'Unlock unlimited seats and priority support'}
              </p>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
