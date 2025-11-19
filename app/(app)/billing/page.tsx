import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function BillingPage() {
  return (
    <>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground">View and manage your billing and subscription</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Subscription & Usage</CardTitle>
          <CardDescription>Manage your billing and subscription</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Billing management coming soon...</p>
        </CardContent>
      </Card>
    </>
  );
}
