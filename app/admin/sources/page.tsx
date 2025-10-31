'use client';

import { useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Id } from '@/convex/_generated/dataModel';

export default function SourcesAdminPage() {
  const [enabledFilter, setEnabledFilter] = useState<boolean | undefined>(undefined);
  const [showImport, setShowImport] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    total: number;
    created: number;
    updated: number;
    errors: number;
    errorMessages: string[];
  } | null>(null);

  const sources = useQuery(api.sources.query.listSources, {
    enabled: enabledFilter,
  });
  const deleteSource = useMutation(api.sources.mutation.deleteSource);
  const importSources = useAction(api.sources.action.importSourcesFromText);

  const handleDelete = async (sourceId: Id<'sources'>) => {
    if (!confirm('Are you sure you want to delete this source?')) {
      return;
    }
    try {
      await deleteSource({ sourceId });
    } catch (error) {
      alert('Failed to delete source: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleImport = async () => {
    if (!file) {
      alert('Please select a file');
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const result = await importSources({
        csvText: text,
      });
      setImportResult(result);
      setFile(null);
    } catch (error) {
      alert('Import failed: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-2">Source Management</h2>
          <p className="text-muted-foreground">Manage event sources (municipal websites, PDFs, APIs)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowImport(!showImport)} variant="outline">
            {showImport ? 'Cancel Import' : 'Bulk Import'}
          </Button>
          <Link href="/admin/sources/new">
            <Button>Create Source</Button>
          </Link>
        </div>
      </div>

      {showImport && (
        <div className="p-4 border-2 border-slate-200 dark:border-slate-800 rounded-md space-y-4">
          <h3 className="font-semibold">Import Sources from CSV/TSV</h3>
          <div className="space-y-2">
            <input
              type="file"
              accept=".csv,.tsv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border-2 border-slate-200 dark:border-slate-800 rounded-md bg-background"
            />
            {file && <p className="text-sm text-muted-foreground">Selected: {file.name}</p>}
          </div>
          <Button onClick={handleImport} disabled={!file || importing}>
            {importing ? 'Importing...' : 'Import'}
          </Button>
          {importResult && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-md">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Import Complete</p>
              <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                <p>Total: {importResult.total}</p>
                <p>Created: {importResult.created}</p>
                <p>Updated: {importResult.updated}</p>
                {importResult.errors > 0 && (
                  <>
                    <p className="text-red-600 dark:text-red-400">Errors: {importResult.errors}</p>
                    {importResult.errorMessages.length > 0 && (
                      <ul className="list-disc list-inside text-xs">
                        {importResult.errorMessages.slice(0, 10).map((msg, idx) => (
                          <li key={idx}>{msg}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={enabledFilter === undefined ? 'default' : 'outline'}
            onClick={() => setEnabledFilter(undefined)}
          >
            All
          </Button>
          <Button variant={enabledFilter === true ? 'default' : 'outline'} onClick={() => setEnabledFilter(true)}>
            Enabled
          </Button>
          <Button variant={enabledFilter === false ? 'default' : 'outline'} onClick={() => setEnabledFilter(false)}>
            Disabled
          </Button>
        </div>

        {sources === undefined ? (
          <div className="text-center py-8">Loading...</div>
        ) : sources.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No sources found</div>
        ) : (
          <div className="border-2 border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">URL</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Location</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Lang</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Profile</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Last Fetch</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source._id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-4 py-3 text-sm">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {source.url.length > 40 ? source.url.substring(0, 40) + '...' : source.url}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm">{source.name || '-'}</td>
                    <td className="px-4 py-3 text-sm">{source.locationName || '-'}</td>
                    <td className="px-4 py-3 text-sm">{source.entityType || '-'}</td>
                    <td className="px-4 py-3 text-sm">{source.lang || '-'}</td>
                    <td className="px-4 py-3 text-sm">{source.profileSiteId || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs ${source.enabled ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}`}
                      >
                        {source.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {source.lastFetchAt ? new Date(source.lastFetchAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <Link href={`/admin/sources/${source._id}`}>
                          <Button variant="ghost" size="sm">
                            Edit
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(source._id)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
