import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TemplatesPage() {
  return (
    <>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Templates</h2>
        <p className="text-muted-foreground">View and manage all certificate templates</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Certificate Templates</CardTitle>
          <CardDescription>Create and manage certificate templates</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Template editor coming soon...</p>
        </CardContent>
      </Card>
    </>
  );
}
