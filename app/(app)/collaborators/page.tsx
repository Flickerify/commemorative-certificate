import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function CollaboratorsPage() {
  return (
    <>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Collaborators</h2>
        <p className="text-muted-foreground">View and manage all collaborators</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage collaborators and their roles</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">User management with WorkOS Widgets coming soon...</p>
        </CardContent>
      </Card>
    </>
  );
}
