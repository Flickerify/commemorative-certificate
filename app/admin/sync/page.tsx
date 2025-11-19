'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function SyncStatusPage() {
  const failedSyncs = useQuery(api.sync.query.getFailedSyncs, { limit: 50 });
  const allSyncs = useQuery(api.sync.query.getSyncStatus, { limit: 50 });

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sync Status</h1>
        <p className="text-muted-foreground">Monitor WorkOS to PlanetScale synchronization</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Failed Syncs</CardTitle>
          <CardDescription>Entities that failed to sync to PlanetScale</CardDescription>
        </CardHeader>
        <CardContent>
          {failedSyncs === undefined ? (
            <div>Loading...</div>
          ) : failedSyncs.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No failed syncs</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Last Synced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedSyncs.map((sync) => (
                  <TableRow key={sync._id}>
                    <TableCell>{sync.entityType}</TableCell>
                    <TableCell>{sync.entityId}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{sync.status}</Badge>
                    </TableCell>
                    <TableCell className="text-red-500">{sync.error}</TableCell>
                    <TableCell>{new Date(sync.lastSyncedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Syncs</CardTitle>
          <CardDescription>Latest synchronization events</CardDescription>
        </CardHeader>
        <CardContent>
          {allSyncs === undefined ? (
            <div>Loading...</div>
          ) : allSyncs.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No sync activity</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Synced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allSyncs.map((sync) => (
                  <TableRow key={sync._id}>
                    <TableCell>{sync.entityType}</TableCell>
                    <TableCell>{sync.entityId}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          sync.status === 'success' ? 'default' : sync.status === 'failed' ? 'destructive' : 'secondary'
                        }
                      >
                        {sync.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(sync.lastSyncedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
