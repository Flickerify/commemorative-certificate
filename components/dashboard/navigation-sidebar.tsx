'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { api } from '@/convex/_generated/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { usePermissions } from '@/components/rbac';
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
  Shield,
  Key,
  Activity,
  Settings,
  Layers,
  CreditCard,
  User,
  Palette,
  Bell,
  Lock,
  Sparkles,
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

// Items available to all workspaces
const adminBaseItems = [
  { href: '/administration/organization', icon: Building2, label: 'Organization' },
  { href: '/administration/billing', icon: CreditCard, label: 'Billing' },
];

// Items that require Pro+ (team features)
const adminTeamItems = [{ href: '/administration/team', icon: UsersIcon, label: 'Team Members' }];

// Security items available to all paid plans
const adminSecurityItems = [
  { href: '/administration/security', icon: Shield, label: 'Security Settings' },
  { href: '/administration/apikeys', icon: Key, label: 'API Keys' },
];

// Enterprise-only items
const adminEnterpriseItems = [{ href: '/administration/audit', icon: Activity, label: 'Audit Logs' }];

const accountItems = [
  { href: '/account/profile', icon: User, label: 'Profile' },
  { href: '/account/preferences', icon: Palette, label: 'Preferences' },
  { href: '/account/notifications', icon: Bell, label: 'Notifications' },
];

const spaceConfig: Record<SpaceType, { title: string; icon: typeof Database }> = {
  catalog: { title: 'Catalog Space', icon: Database },
  compatibility: { title: 'Compatibility', icon: GitBranch },
  administration: { title: 'Administration', icon: Settings },
  account: { title: 'Account', icon: User },
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
          : 'text-sidebar-foreground hover:bg-sidebar-accent',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function LockedNavLink({ icon: Icon, label, onClick }: { icon: typeof Database; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-sidebar-muted hover:bg-sidebar-accent/50 w-full text-left group"
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      <span className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 opacity-80 group-hover:opacity-100">
        <Lock className="h-2.5 w-2.5" />
        Pro+
      </span>
    </button>
  );
}

function EnterpriseNavLink({
  href,
  icon: Icon,
  label,
  isActive,
  isEnterprise,
  onClick,
  onUpgradeClick,
}: {
  href: string;
  icon: typeof Database;
  label: string;
  isActive: boolean;
  isEnterprise: boolean;
  onClick?: () => void;
  onUpgradeClick?: () => void;
}) {
  if (isEnterprise) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'text-sidebar-foreground hover:bg-sidebar-accent',
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1">{label}</span>
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400">
          Enterprise
        </span>
      </Link>
    );
  }

  return (
    <button
      onClick={onUpgradeClick}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-sidebar-muted hover:bg-sidebar-accent/50 w-full text-left group"
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      <span className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 opacity-80 group-hover:opacity-100">
        <Lock className="h-2.5 w-2.5" />
        Enterprise
      </span>
    </button>
  );
}

export function NavigationSidebar({ activeSpace, isMobileOpen, onMobileClose, isNavOpen }: NavigationSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { organizationId } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();

  // Fetch current organization (includes subscriptionTier from source of truth)
  const organization = useQuery(api.organizations.query.getCurrent, organizationId ? { organizationId } : 'skip');

  // Check subscription tiers (for upgrade prompts)
  const isPersonalWorkspace = organization?.subscriptionTier === 'personal';
  const isEnterprise = organization?.subscriptionTier === 'enterprise';

  // Check RBAC permissions for navigation items
  const canViewTeam = hasPermission('organization:membership:read-only');
  const canManageTeam = hasPermission('organization:membership:manage');
  const canViewBilling = hasPermission('finance:billing:read-only');
  const canViewSettings = hasPermission('organization:settings:read-only');
  const canViewAudit = hasPermission('audit:logs:read-only');
  const canViewSchemas = hasPermission('content:schemas:read-only');
  const canViewRules = hasPermission('content:rules:read-only');

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const handleUpgradeClick = () => {
    onMobileClose();
    router.push('/administration/billing');
  };

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
              <h3 className="px-3 text-xs font-medium text-sidebar-muted uppercase tracking-wider mb-2">Publishing</h3>
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
              {/* Organization - available if user can view settings */}
              {canViewSettings && (
                <NavLink
                  href="/administration/organization"
                  icon={Building2}
                  label="Organization"
                  isActive={isActive('/administration/organization')}
                  onClick={onMobileClose}
                />
              )}

              {/* Team items - requires membership permission + Pro+ tier */}
              {canViewTeam ? (
                isPersonalWorkspace ? (
                  // Has permission but tier too low - show upgrade prompt
                  <LockedNavLink
                    icon={UsersIcon}
                    label="Team Members"
                    onClick={handleUpgradeClick}
                  />
                ) : (
                  // Has permission and tier - show link
                  <NavLink
                    href="/administration/team"
                    icon={UsersIcon}
                    label="Team Members"
                    isActive={isActive('/administration/team')}
                    onClick={onMobileClose}
                  />
                )
              ) : null}

              {/* Billing - available if user can view billing */}
              {canViewBilling && (
                <NavLink
                  href="/administration/billing"
                  icon={CreditCard}
                  label="Billing"
                  isActive={isActive('/administration/billing')}
                  onClick={onMobileClose}
                />
              )}
            </nav>

            {/* Upgrade CTA for personal workspaces */}
            {isPersonalWorkspace && canViewBilling && (
              <div
                className="mt-4 p-3 rounded-lg bg-linear-to-r from-primary/5 to-primary/10 cursor-pointer hover:from-primary/10 hover:to-primary/15 transition-colors"
                onClick={handleUpgradeClick}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-sidebar-foreground">Upgrade to Pro</span>
                </div>
                <p className="text-xs text-sidebar-muted">Invite team members and unlock collaboration features</p>
              </div>
            )}

            <div className="mt-6">
              <h3 className="px-3 text-xs font-medium text-sidebar-muted uppercase tracking-wider mb-2">Security</h3>
              <nav className="flex flex-col gap-1">
                {/* Security settings - available if user can view settings */}
                {canViewSettings && (
                  <>
                    <NavLink
                      href="/administration/security"
                      icon={Shield}
                      label="Security Settings"
                      isActive={isActive('/administration/security')}
                      onClick={onMobileClose}
                    />
                    <NavLink
                      href="/administration/apikeys"
                      icon={Key}
                      label="API Keys"
                      isActive={isActive('/administration/apikeys')}
                      onClick={onMobileClose}
                    />
                  </>
                )}

                {/* Audit logs - requires audit permission + enterprise tier */}
                {canViewAudit ? (
                  isEnterprise ? (
                    <Link
                      href="/administration/audit"
                      onClick={onMobileClose}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        isActive('/administration/audit')
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent',
                      )}
                    >
                      <Activity className="h-4 w-4" />
                      <span className="flex-1">Audit Logs</span>
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400">
                        Enterprise
                      </span>
                    </Link>
                  ) : (
                    <button
                      onClick={handleUpgradeClick}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-sidebar-muted hover:bg-sidebar-accent/50 w-full text-left group"
                    >
                      <Activity className="h-4 w-4" />
                      <span className="flex-1">Audit Logs</span>
                      <span className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 opacity-80 group-hover:opacity-100">
                        <Lock className="h-2.5 w-2.5" />
                        Enterprise
                      </span>
                    </button>
                  )
                ) : null}
              </nav>
            </div>
          </>
        );
      case 'account':
        return (
          <nav className="flex flex-col gap-1">
            {accountItems.map((item) => (
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
          'w-64',
        )}
      >
        <div className="flex flex-col h-full min-w-64">
          {/* Header with space switcher */}
          <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <currentSpace.icon className="h-4 w-4 shrink-0 text-sidebar-muted" />
              <span className="font-semibold text-sidebar-foreground">{currentSpace.title}</span>
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
              {Object.entries(spaceConfig)
                .filter(([key]) => key !== 'account') // Account is accessed via user menu
                .map(([key, config]) => (
                  <Link
                    key={key}
                    href={
                      key === 'catalog'
                        ? '/catalog/sources'
                        : key === 'compatibility'
                          ? '/compatibility/rules'
                          : '/administration/organization'
                    }
                    onClick={onMobileClose}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors',
                      activeSpace === key
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        : 'text-sidebar-muted hover:bg-sidebar-accent/50',
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
