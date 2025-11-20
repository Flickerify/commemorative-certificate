'use client';

import * as React from 'react';
import {
  IconBuildingBank,
  IconCheck,
  IconLogout,
  IconPlus,
  IconSettings,
  IconSelector,
  IconUsers,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@workos-inc/authkit-nextjs/components';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import type { OrganizationsWithRole } from '@/convex/types';
import { switchToOrganization } from '@workos-inc/authkit-nextjs';

export function OrganizationSwitcher({ organisations }: { organisations: OrganizationsWithRole[] | null | undefined }) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const { signOut, organizationId } = useAuth();

  const handleSwitchToOrganization = (organizationId: string) => {
    switchToOrganization(organizationId);
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <IconBuildingBank className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {organisations?.find((org) => org.externalId === organizationId)?.name || 'Select Organization'}
                </span>
                <span className="truncate text-xs">
                  {organisations?.find((org) => org.externalId === organizationId)?.role || 'Member'}
                </span>
              </div>
              <IconSelector className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">Organizations</DropdownMenuLabel>
            {organisations?.map((org) => (
              <DropdownMenuItem
                key={org._id}
                onClick={() => handleSwitchToOrganization(org.externalId)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <IconBuildingBank className="size-4 shrink-0" />
                </div>
                {org.name}
                {organizationId === org.externalId && <IconCheck className="ml-auto size-4" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" onClick={() => router.push('/collaborators')}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <IconPlus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Invite members</div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/collaborators')}>
                <IconUsers className="mr-2 size-4" />
                Manage members
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/account')}>
                <IconSettings className="mr-2 size-4" />
                Account settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <IconLogout className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
