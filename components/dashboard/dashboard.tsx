'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { IconSidebar } from './icon-sidebar';
import { NavigationSidebar } from './navigation-sidebar';
import { RightSidebar } from './right-sidebar';
import { DashboardProvider } from './dashboard-context';

export type SpaceType = 'catalog' | 'compatibility' | 'administration';

interface DashboardProps {
  children: ReactNode;
}

export default function Dashboard({ children }: DashboardProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [isNavSidebarOpen, setIsNavSidebarOpen] = useState(true);

  // Derive active space from pathname
  const getActiveSpace = (): SpaceType => {
    if (pathname.startsWith('/compatibility')) return 'compatibility';
    if (pathname.startsWith('/administration')) return 'administration';
    return 'catalog'; // default to catalog for /catalog/* and root
  };

  const activeSpace = getActiveSpace();

  const dashboardContextValue = {
    isRightSidebarOpen,
    toggleRightSidebar: () => setIsRightSidebarOpen(!isRightSidebarOpen),
    isMobileMenuOpen,
    toggleMobileMenu: () => setIsMobileMenuOpen(!isMobileMenuOpen),
  };

  return (
    <DashboardProvider value={dashboardContextValue}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Icon Sidebar - Space Switcher */}
        <IconSidebar
          className="hidden md:flex"
          activeSpace={activeSpace}
          onNavSidebarToggle={() => setIsNavSidebarOpen(!isNavSidebarOpen)}
          isNavSidebarOpen={isNavSidebarOpen}
        />

        {/* Navigation Sidebar */}
        <NavigationSidebar
          activeSpace={activeSpace}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
          isNavOpen={isNavSidebarOpen}
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">{children}</div>
        </main>

        {/* Right Sidebar */}
        <RightSidebar
          isOpen={isRightSidebarOpen}
          onClose={() => setIsRightSidebarOpen(false)}
          activeSpace={activeSpace}
        />
      </div>
    </DashboardProvider>
  );
}
