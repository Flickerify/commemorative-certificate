import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function IntegrationsPage() {
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
            <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>LMS Connections</CardTitle>
                <CardDescription>Integrate with learning management systems</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Moodle, Canvas, Teachable integrations coming soon...</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>HRIS Connections</CardTitle>
                <CardDescription>Connect to HR information systems</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Workday, BambooHR integrations coming soon...</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Automation</CardTitle>
                <CardDescription>Zapier and Make integrations</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Automation platforms coming soon...</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Webhooks</CardTitle>
                <CardDescription>Configure outgoing webhooks</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Webhook configuration coming soon...</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
