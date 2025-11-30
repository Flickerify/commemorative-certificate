'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Building2, Check, ChevronDown, Plus, Settings, Users, UserPlus, Sparkles, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Organization {
  id: string;
  name: string;
  logo?: string;
  role: 'owner' | 'admin' | 'member';
  plan: 'free' | 'pro' | 'enterprise';
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

const organizations: Organization[] = [
  {
    id: 'org-1',
    name: 'Acme Corporation',
    role: 'owner',
    plan: 'enterprise',
  },
  {
    id: 'org-2',
    name: 'Design Studio',
    role: 'admin',
    plan: 'pro',
  },
  {
    id: 'org-3',
    name: 'Startup Inc',
    role: 'member',
    plan: 'free',
  },
];

const planColors = {
  free: 'bg-muted text-muted-foreground',
  pro: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  enterprise: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
};

function OrgAvatar({
  name,
  logo,
  size = 'md',
  className,
}: {
  name: string;
  logo?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-10 w-10 text-sm',
  };

  if (logo) {
    return <img src={logo} alt={name} className={cn('rounded-lg object-cover', sizeClasses[size], className)} />;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold',
        sizeClasses[size],
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}

export function OrganizationSwitcher({ className }: { className?: string }) {
  const [selectedOrg, setSelectedOrg] = useState<string>('personal');
  const [isOpen, setIsOpen] = useState(false);

  const currentOrg = organizations.find((o) => o.id === selectedOrg);
  const isPersonal = selectedOrg === 'personal';

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg transition-all overflow-hidden',
            !currentOrg?.logo && 'bg-primary text-primary-foreground',
            'hover:ring-2 hover:ring-primary/20 hover:ring-offset-2 hover:ring-offset-sidebar',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-sidebar',
            'relative group',
            className,
          )}
        >
          {isPersonal ? (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500 to-violet-600 text-white">
              <User className="h-5 w-5" />
            </div>
          ) : currentOrg ? (
            currentOrg.logo ? (
              <img src={currentOrg.logo} alt={currentOrg.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-semibold">{getInitials(currentOrg.name)}</span>
            )
          ) : (
            <Building2 className="h-5 w-5" />
          )}
          <ChevronDown className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-sidebar text-sidebar-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" sideOffset={12} className="w-72 p-0 overflow-hidden">
        <div className="bg-muted/50 px-3 py-3 border-b">
          <div className="flex items-center gap-3">
            {isPersonal ? (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 text-white font-semibold shadow-sm">
                  <User className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">Personal Workspace</p>
                  <p className="text-xs text-muted-foreground">Your private space</p>
                </div>
              </>
            ) : currentOrg ? (
              <>
                <OrgAvatar name={currentOrg.name} logo={currentOrg.logo} size="lg" className="shadow-sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{currentOrg.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{currentOrg.role}</p>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium px-2 py-0.5 rounded-full capitalize',
                    planColors[currentOrg.plan],
                  )}
                >
                  {currentOrg.plan}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <DropdownMenuGroup className="p-1.5">
          <DropdownMenuItem
            onClick={() => setSelectedOrg('personal')}
            className={cn(
              'flex items-center gap-3 px-2 py-2.5 rounded-md cursor-pointer',
              isPersonal && 'bg-primary/5',
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-violet-600 text-white">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Personal Workspace</p>
              <p className="text-xs text-muted-foreground">Your private space</p>
            </div>
            {isPersonal && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-0" />

        <DropdownMenuGroup className="p-1.5">
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1.5">
            Organizations
          </DropdownMenuLabel>

          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => setSelectedOrg(org.id)}
              className={cn(
                'flex items-center gap-3 px-2 py-2.5 rounded-md cursor-pointer',
                selectedOrg === org.id && 'bg-primary/5',
              )}
            >
              <OrgAvatar
                name={org.name}
                logo={org.logo}
                size="sm"
                className={!org.logo ? 'bg-gradient-to-br from-muted to-muted/50 text-foreground' : ''}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{org.name}</p>
                  <span className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded capitalize', planColors[org.plan])}>
                    {org.plan}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground capitalize">{org.role}</p>
              </div>
              {selectedOrg === org.id && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-0" />

        <DropdownMenuGroup className="p-1.5">
          <DropdownMenuItem className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
              <Plus className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-sm">Create organization</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {!isPersonal && (
          <>
            <DropdownMenuSeparator className="my-0" />

            <DropdownMenuGroup className="p-1.5">
              <DropdownMenuItem className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer">
                <UserPlus className="h-4 w-4 text-muted-foreground ml-2" />
                <span className="text-sm">Invite members</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer">
                <Users className="h-4 w-4 text-muted-foreground ml-2" />
                <span className="text-sm">Manage members</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer">
                <Settings className="h-4 w-4 text-muted-foreground ml-2" />
                <span className="text-sm">Organization settings</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        {!isPersonal && currentOrg && currentOrg.plan !== 'enterprise' && (
          <>
            <DropdownMenuSeparator className="my-0" />
            <div className="p-3 bg-gradient-to-r from-primary/5 to-primary/10">
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
