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
import { OrganizationSwitcher } from '@/components/organization-switcher';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar';

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
  const organisations = useQuery(api.organisations.query.getOrganisationsByUserId);

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
        <OrganizationSwitcher organisations={organisations} />
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
