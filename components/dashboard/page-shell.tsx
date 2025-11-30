'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, PanelRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboard } from './dashboard-context';

interface PageShellProps {
  children: ReactNode;
  title: string;
  description?: string;
  headerActions?: ReactNode;
  footerText?: string;
  className?: string;
}

export function PageShell({ children, title, description, headerActions, footerText, className }: PageShellProps) {
  const { toggleRightSidebar, toggleMobileMenu, isRightSidebarOpen } = useDashboard();

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3 lg:px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleMobileMenu}
            className="flex h-9 w-9 items-center justify-center rounded-lg md:hidden hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 bg-transparent">
            <Search className="h-4 w-4" />
          </Button>
          {headerActions}
          <Button
            variant="outline"
            size="icon"
            className={cn('h-9 w-9 bg-transparent hidden lg:flex', isRightSidebarOpen && 'bg-accent')}
            onClick={toggleRightSidebar}
          >
            <PanelRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>

      {/* Footer */}
      {footerText && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 lg:px-6">
          <span className="text-sm text-muted-foreground">{footerText}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              Previous
            </Button>
            <Button variant="outline" size="sm">
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
