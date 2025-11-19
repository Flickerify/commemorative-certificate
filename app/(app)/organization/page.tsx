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
    <>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Organization</h2>
        <p className="text-muted-foreground">View and manage your organization</p>
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
                  switchToOrganization={({ organizationId }) => switchToOrganization(organizationId)}
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
    </>
  );
}
