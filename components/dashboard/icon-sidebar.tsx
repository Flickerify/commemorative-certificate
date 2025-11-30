'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Database, GitBranch, Settings, HelpCircle, PanelLeftClose, PanelLeftOpen, ExternalLink } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { OrganizationSwitcher } from './dropdowns/organization-switcher';
import { UserAccountDropdown } from './dropdowns/user-account-dropdown';
import type { SpaceType } from './dashboard';

interface IconSidebarProps {
  className?: string;
  activeSpace: SpaceType;
  onNavSidebarToggle: () => void;
  isNavSidebarOpen: boolean;
}

const spaceItems: { id: SpaceType; href: string; icon: typeof Database; label: string; description: string; docUrl: string }[] = [
  {
    id: 'catalog',
    href: '/catalog/sources',
    icon: Database,
    label: 'Catalog Space',
    description: 'Create and manage source & target definitions, schemas, and data imports.',
    docUrl: 'https://docs.compat.io/spaces/catalog',
  },
  {
    id: 'compatibility',
    href: '/compatibility/rules',
    icon: GitBranch,
    label: 'Compatibility Space',
    description: 'Define rules, policies, and test compatibility results between sources and targets.',
    docUrl: 'https://docs.compat.io/spaces/compatibility',
  },
  {
    id: 'administration',
    href: '/administration/organization',
    icon: Settings,
    label: 'Administration Space',
    description: 'Configure organization settings, manage team roles, and control permissions.',
    docUrl: 'https://docs.compat.io/spaces/administration',
  },
];

export function IconSidebar({
  className,
  activeSpace,
  onNavSidebarToggle,
  isNavSidebarOpen,
}: IconSidebarProps) {
  return (
    <TooltipProvider delayDuration={100}>
      <div
        className={cn(
          'flex flex-col items-center justify-between w-14 border-r border-sidebar-border bg-sidebar py-4',
          className
        )}
      >
        <div className="flex flex-col items-center gap-4">
          <OrganizationSwitcher />

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onNavSidebarToggle}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                {isNavSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{isNavSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}</TooltipContent>
          </Tooltip>

          <nav className="flex flex-col items-center gap-2">
            {spaceItems.map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                      activeSpace === item.id
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-52 p-0">
                  <div className="p-2.5 space-y-1">
                    <p className="font-medium text-xs text-white">{item.label}</p>
                    <p className="text-xs text-white/70 leading-relaxed">{item.description}</p>
                    <a
                      href={item.docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 hover:underline pt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Learn more
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </nav>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
                <HelpCircle className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Help & Support</TooltipContent>
          </Tooltip>

          <UserAccountDropdown />
        </div>
      </div>
    </TooltipProvider>
  );
}
