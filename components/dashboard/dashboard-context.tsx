'use client';

import { createContext, useContext, type ReactNode } from 'react';

interface DashboardContextValue {
  isRightSidebarOpen: boolean;
  toggleRightSidebar: () => void;
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}

interface DashboardProviderProps {
  children: ReactNode;
  value: DashboardContextValue;
}

export function DashboardProvider({ children, value }: DashboardProviderProps) {
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

