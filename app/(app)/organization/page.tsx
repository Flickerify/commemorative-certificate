import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  UsersManagement,
  WorkOsWidgets,
  AdminPortalDomainVerification,
  AdminPortalSsoConnection,
} from '@workos-inc/widgets';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { workos } from '@/app/workos';

export default async function OrganizationPage() {
  const { user, organizationId } = await withAuth({
    ensureSignedIn: true,
  });

  if (!organizationId) {
    return <p>User does not belong to an organization</p>;
  }

  const authToken = await workos.widgets.getToken({
    userId: user.id,
    organizationId,
    scopes: ['widgets:users-table:manage', 'widgets:domain-verification:manage', 'widgets:sso:manage'],
  });

  return (
    <>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Organization</h2>
        <p className="text-muted-foreground">View and manage your organization</p>
      </div>

      {!authToken && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      )}

      {authToken && (
        <WorkOsWidgets>
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Users Management</CardTitle>
                <CardDescription>Manage team members, invite users, and assign roles</CardDescription>
              </CardHeader>
              <CardContent>
                <UsersManagement authToken={authToken} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Domain Verification</CardTitle>
                <CardDescription>Verify your organization's domain</CardDescription>
              </CardHeader>
              <CardContent>
                <AdminPortalDomainVerification authToken={authToken} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SSO Connection</CardTitle>
                <CardDescription>Manage your organization's SSO connections</CardDescription>
              </CardHeader>
              <CardContent>
                <AdminPortalSsoConnection authToken={authToken} />
              </CardContent>
            </Card>
          </div>
        </WorkOsWidgets>
      )}
    </>
  );
}
