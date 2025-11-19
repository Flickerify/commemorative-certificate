import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function AnalyticsPage() {
  return (
    <>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground">View and manage all analytics</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Certificate Issuance</CardTitle>
            <CardDescription>Track certificate issuance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-muted-foreground">Total issued</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Verifications</CardTitle>
            <CardDescription>Monitor verification activity</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-muted-foreground">Total verifications</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Badge Shares</CardTitle>
            <CardDescription>Track social media engagement</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-muted-foreground">Total shares</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
