'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccessToken } from '@workos-inc/authkit-nextjs/components';
import { UserProfile, UserSecurity, UserSessions, WorkOsWidgets } from '@workos-inc/widgets';
import * as jose from 'jose';

export default function AccountPage() {
  const { accessToken, loading: tokenLoading, error: tokenError } = useAccessToken();

  const sessionId = jose.decodeJwt(accessToken || '').sid as string;
  return (
    <>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Account</h2>
        <p className="text-muted-foreground">View and manage your account information</p>
      </div>

      {tokenLoading ||
        (!sessionId && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        ))}

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
                <CardTitle>Account Profile</CardTitle>
                <CardDescription>View and manage your account profile</CardDescription>
              </CardHeader>
              <CardContent>
                <UserProfile authToken={accessToken} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>View and manage your account information</CardDescription>
              </CardHeader>
              <CardContent>
                <UserSecurity authToken={accessToken} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Sessions</CardTitle>
                <CardDescription>View and manage your account sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <UserSessions authToken={accessToken} currentSessionId={sessionId} />
              </CardContent>
            </Card>
          </div>
        </WorkOsWidgets>
      )}
    </>
  );
}
