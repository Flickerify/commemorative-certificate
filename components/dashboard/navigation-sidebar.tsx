'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Database,
  Target,
  Upload,
  FileCode,
  ChevronDown,
  X,
  GitBranch,
  FileCheck,
  AlertOctagon,
  FlaskConical,
  History,
  CloudUpload,
  Building2,
  UsersIcon,
  UserCog,
  Shield,
  Key,
  Activity,
  Settings,
  Layers,
} from 'lucide-react';
import type { SpaceType } from './dashboard';

interface NavigationSidebarProps {
  activeSpace: SpaceType;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  isNavOpen: boolean;
}

const catalogMainItems = [
  { href: '/catalog/sources', icon: Database, label: 'Sources' },
  { href: '/catalog/targets', icon: Target, label: 'Targets' },
  { href: '/catalog/imports', icon: Upload, label: 'Imports' },
  { href: '/catalog/schemas', icon: FileCode, label: 'Schemas' },
];

const compatibilityMainItems = [
  { href: '/compatibility/rules', icon: GitBranch, label: 'Rules' },
  { href: '/compatibility/policies', icon: FileCheck, label: 'Policies' },
  { href: '/compatibility/overrides', icon: AlertOctagon, label: 'Overrides' },
  { href: '/compatibility/playground', icon: FlaskConical, label: 'Test Playground' },
];

const compatibilityPublishItems = [
  { href: '/compatibility/revisions', icon: History, label: 'Revisions' },
  { href: '/compatibility/publish-logs', icon: CloudUpload, label: 'Publish Logs' },
];

const adminOrgItems = [
  { href: '/administration/organization', icon: Building2, label: 'Organization' },
  { href: '/administration/team', icon: UsersIcon, label: 'Team Members' },
  { href: '/administration/roles', icon: UserCog, label: 'Roles & Permissions' },
];

const adminSecurityItems = [
  { href: '/administration/security', icon: Shield, label: 'Security Settings' },
  { href: '/administration/apikeys', icon: Key, label: 'API Keys' },
  { href: '/administration/audit', icon: Activity, label: 'Audit Logs' },
];

const spaceConfig: Record<SpaceType, { title: string; icon: typeof Database }> = {
  catalog: { title: 'Catalog Space', icon: Database },
  compatibility: { title: 'Compatibility', icon: GitBranch },
  administration: { title: 'Administration', icon: Settings },
};

function NavLink({
  href,
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  href: string;
  icon: typeof Database;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-sidebar-foreground hover:bg-sidebar-accent'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function NavigationSidebar({
  activeSpace,
  isMobileOpen,
  onMobileClose,
  isNavOpen,
}: NavigationSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const getNavigationContent = () => {
    switch (activeSpace) {
      case 'catalog':
        return (
          <nav className="flex flex-col gap-1">
            {catalogMainItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                isActive={isActive(item.href)}
                onClick={onMobileClose}
              />
            ))}
          </nav>
        );
      case 'compatibility':
        return (
          <>
            <nav className="flex flex-col gap-1">
              {compatibilityMainItems.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  isActive={isActive(item.href)}
                  onClick={onMobileClose}
                />
              ))}
            </nav>

            <div className="mt-6">
              <h3 className="px-3 text-xs font-medium text-sidebar-muted uppercase tracking-wider mb-2">
                Publishing
              </h3>
              <nav className="flex flex-col gap-1">
                {compatibilityPublishItems.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    isActive={isActive(item.href)}
                    onClick={onMobileClose}
                  />
                ))}
              </nav>
            </div>
          </>
        );
      case 'administration':
        return (
          <>
            <nav className="flex flex-col gap-1">
              {adminOrgItems.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  isActive={isActive(item.href)}
                  onClick={onMobileClose}
                />
              ))}
            </nav>

            <div className="mt-6">
              <h3 className="px-3 text-xs font-medium text-sidebar-muted uppercase tracking-wider mb-2">
                Security
              </h3>
              <nav className="flex flex-col gap-1">
                {adminSecurityItems.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    isActive={isActive(item.href)}
                    onClick={onMobileClose}
                  />
                ))}
              </nav>
            </div>
          </>
        );
    }
  };

  const currentSpace = spaceConfig[activeSpace];

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onMobileClose} />}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out md:static',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
          isNavOpen
            ? 'md:translate-x-0 md:w-64 md:opacity-100'
            : 'md:translate-x-0 md:w-0 md:opacity-0 md:border-r-0 md:overflow-hidden',
          'w-64'
        )}
      >
        <div className="flex flex-col h-full min-w-64">
          {/* Header with space switcher */}
          <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <currentSpace.icon className="h-4 w-4 shrink-0 text-sidebar-muted" />
              <span className="font-semibold text-sidebar-foreground">{currentSpace.title}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-sidebar-muted" />
            </div>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg md:hidden hover:bg-sidebar-accent shrink-0"
              onClick={onMobileClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mobile Space Switcher */}
          <div className="md:hidden border-b border-sidebar-border p-3">
            <div className="flex gap-1">
              {Object.entries(spaceConfig).map(([key, config]) => (
                <Link
                  key={key}
                  href={key === 'catalog' ? '/catalog/sources' : key === 'compatibility' ? '/compatibility/rules' : '/administration/organization'}
                  onClick={onMobileClose}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors',
                    activeSpace === key
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-muted hover:bg-sidebar-accent/50'
                  )}
                >
                  <config.icon className="h-3.5 w-3.5" />
                </Link>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto p-3">{getNavigationContent()}</div>

          {/* Usage Section */}
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center justify-between mb-3 whitespace-nowrap">
              <span className="text-xs font-medium text-sidebar-muted">Usage This Month</span>
              <ChevronDown className="h-3 w-3 shrink-0 text-sidebar-muted" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm whitespace-nowrap">
                <div className="flex items-center gap-2 text-sidebar-foreground">
                  <Database className="h-3.5 w-3.5 shrink-0" />
                  <span>Records</span>
                </div>
                <span className="text-sidebar-muted">12.4K of 50K</span>
              </div>
              <Progress value={24.8} className="h-1" />

              <div className="flex items-center justify-between text-sm whitespace-nowrap">
                <div className="flex items-center gap-2 text-sidebar-foreground">
                  <Layers className="h-3.5 w-3.5 shrink-0" />
                  <span>API Calls</span>
                </div>
                <span className="text-sidebar-muted">8.2K of 100K</span>
              </div>
              <Progress value={8.2} className="h-1" />
            </div>

            <p className="text-xs text-sidebar-muted mt-3 whitespace-nowrap">Resets Dec 1, 2025</p>

            <Button className="w-full mt-4 whitespace-nowrap" size="sm">
              Upgrade Plan
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
