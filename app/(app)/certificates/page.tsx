import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CertificatesPage() {
  return (
    <>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Certificates</h2>
        <p className="text-muted-foreground">View and manage all issued certificates</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Issued Certificates</CardTitle>
          <CardDescription>View and manage all issued certificates</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Certificate management interface coming soon...</p>
        </CardContent>
      </Card>
    </>
  );
}
