import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function IntegrationsPage() {
  return (
    <>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Integrations</h2>
        <p className="text-muted-foreground">View and manage all external integrations</p>
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
    </>
  );
}
