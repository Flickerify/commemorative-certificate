'use client';

import {
  IconBuildingBank,
  IconCheck,
  IconLogout,
  IconPlus,
  IconSettings,
  IconSelector,
  IconUsers,
  IconUser,
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
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { Doc } from '@/convex/_generated/dataModel';

type Organization = Doc<'organisations'> & { role?: string };

export function OrganizationSwitcher({ organisations }: { organisations?: Organization[] | null }) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const { signOut, organizationId, switchToOrganization } = useAuth();

  const handleSwitchToOrganization = async (orgId: string) => {
    await switchToOrganization(orgId);
    router.refresh();
  };

  // Show skeleton while loading organizations
  if (organisations === undefined) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  // Determine current selection
  const currentOrg = organisations?.find((org) => org.externalId === organizationId);
  const personalOrg = organisations?.find((org) => org.metadata?.tier === 'personal');

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
                {personalOrg ? <IconUser className="size-4" /> : <IconBuildingBank className="size-4" />}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{currentOrg?.name}</span>
                <span className="truncate text-xs">{currentOrg?.role}</span>
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
            {/* Personal Account Option */}
            {personalOrg && (
              <DropdownMenuItem
                className="gap-2 p-2"
                onClick={async () => await handleSwitchToOrganization(personalOrg.externalId)}
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <IconUser className="size-4 shrink-0" />
                </div>
                Personal Account
                {personalOrg.externalId === organizationId && <IconCheck className="ml-auto size-4" />}
              </DropdownMenuItem>
            )}

            {organisations
              ?.filter((org) => org.metadata?.tier !== 'personal')
              .map((org) => (
                <DropdownMenuItem
                  key={org._id}
                  onClick={async () => await handleSwitchToOrganization(org.externalId)}
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
