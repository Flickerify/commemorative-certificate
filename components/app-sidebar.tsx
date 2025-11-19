'use client';

import * as React from 'react';
import {
  IconAward,
  IconBuildingBank,
  IconChartBar,
  IconCreditCard,
  IconDashboard,
  IconFileCheck,
  IconHelp,
  IconInnerShadowTop,
  IconPlug,
  IconSettings,
  IconTemplate,
  IconUsers,
} from '@tabler/icons-react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

import { NavDocuments } from '@/components/nav-documents';
import { NavMain } from '@/components/nav-main';
import { NavSecondary } from '@/components/nav-secondary';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const navMain = [
  {
    title: 'Dashboard',
    url: '/',
    icon: IconDashboard,
  },
  {
    title: 'Certificates',
    url: '/certificates',
    icon: IconAward,
  },
  {
    title: 'Templates',
    url: '/templates',
    icon: IconTemplate,
  },
  {
    title: 'Collaborators',
    url: '/collaborators',
    icon: IconUsers,
  },
  {
    title: 'Analytics',
    url: '/analytics',
    icon: IconChartBar,
  },
  {
    title: 'Integrations',
    url: '/integrations',
    icon: IconPlug,
  },
];

const navSecondary = [
  {
    title: 'Billing',
    url: '/billing',
    icon: IconCreditCard,
  },
  {
    title: 'Settings',
    url: '/settings',
    icon: IconSettings,
  },
  {
    title: 'Get Help',
    url: '/help',
    icon: IconHelp,
  },
];

const documents = [
  {
    name: 'Organization',
    url: '/organization',
    icon: IconBuildingBank,
  },
  {
    name: 'Verification',
    url: '/verification/logs',
    icon: IconFileCheck,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, signOut } = useAuth();
  const organisation = useQuery(
    api.organisations.query.getOrganisationByEmail,
    user?.email ? { email: user.email } : 'skip',
  );

  const userData = React.useMemo(() => {
    if (!user) return { name: 'Guest', email: '', avatar: '' };
    return {
      name: user.firstName ? `${user.firstName} ${user.lastName}` : user.email,
      email: user.email,
      avatar: user.profilePictureUrl || '',
    };
  }, [user]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <IconInnerShadowTop className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{organisation?.name || 'Certificate Manager'}</span>
                <span className="truncate text-xs">Enterprise</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavDocuments items={documents} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} onSignOut={signOut} />
      </SidebarFooter>
    </Sidebar>
  );
}
