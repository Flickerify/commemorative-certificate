'use client';

import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { UsersManagement, OrganizationSwitcher, WorkOsWidgets } from '@workos-inc/widgets';
import { useAccessToken } from '@workos-inc/authkit-nextjs/components';
import { switchToOrganization } from '@workos-inc/authkit-nextjs';

export default function OrganizationPage() {
  // Use the access token directly from AuthKit (as per WorkOS Widgets docs)
  // https://workos.com/docs/widgets/tokens

  const { accessToken, loading: tokenLoading, error: tokenError } = useAccessToken();

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Organization</h1>
          </div>

          {tokenLoading && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </CardContent>
            </Card>
          )}

          {tokenError && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-destructive">Error: {tokenError.message}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Make sure you are authenticated and have access to an organization. CORS must be enabled in WorkOS
                  Dashboard → Authentication → Web Origins.
                </p>
              </CardContent>
            </Card>
          )}

          {accessToken && (
            <WorkOsWidgets>
              <div className="flex flex-col gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Organization Switcher</CardTitle>
                    <CardDescription>Switch between organizations you have access to</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <OrganizationSwitcher
                      authToken={accessToken}
                      switchToOrganization={async ({ organizationId }) => {
                        await switchToOrganization(organizationId);
                      }}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Users Management</CardTitle>
                    <CardDescription>Manage team members, invite users, and assign roles</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <UsersManagement authToken={accessToken} />
                  </CardContent>
                </Card>
              </div>
            </WorkOsWidgets>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
