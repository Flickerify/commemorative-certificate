'use client';

import { useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  errors: number;
  errorMessages: string[];
}

export default function LocationsAdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [country, setCountry] = useState('CH');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importLocations = useAction(api.locations.action.importLocationsFromText);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a CSV file');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const csvText = await file.text();
      const importResult = await importLocations({
        csvText,
        country,
      });
      setResult(importResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import locations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Location Management</h2>
        <p className="text-muted-foreground">
          Import locations from CSV files. Duplicates will be automatically updated.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <label htmlFor="country" className="block text-sm font-medium">
            Country
          </label>
          <select
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full px-3 py-2 border-2 border-slate-200 dark:border-slate-800 rounded-md bg-background"
          >
            <option value="CH">Switzerland (CH)</option>
            {/* Add more countries as configurations are added */}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="csv-file" className="block text-sm font-medium">
            CSV File
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full px-3 py-2 border-2 border-slate-200 dark:border-slate-800 rounded-md bg-background file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 dark:file:bg-slate-800 dark:file:text-slate-300"
          />
          {file && (
            <p className="text-sm text-muted-foreground">
              Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        <Button onClick={handleImport} disabled={!file || loading} className="w-full">
          {loading ? 'Importing...' : 'Import Locations'}
        </Button>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">Error</p>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-md">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Import Complete</p>
              <div className="space-y-1 text-sm text-green-700 dark:text-green-300">
                <p>Total rows processed: {result.total}</p>
                <p>Created: {result.created}</p>
                <p>Updated: {result.updated}</p>
                {result.errors > 0 && (
                  <>
                    <p className="text-red-600 dark:text-red-400">Errors: {result.errors}</p>
                    {result.errorMessages.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="font-medium">Error details:</p>
                        <ul className="list-disc list-inside">
                          {result.errorMessages.slice(0, 10).map((msg, idx) => (
                            <li key={idx} className="text-xs">
                              {msg}
                            </li>
                          ))}
                          {result.errorMessages.length > 10 && (
                            <li className="text-xs">... and {result.errorMessages.length - 10} more errors</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-md">
        <h3 className="font-semibold mb-2">CSV Format Requirements</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Must include a header row with column names</li>
          <li>
            Switzerland format: Ortschaftsname;PLZ;Zusatzziffer;Gemeindename;BFS-Nr;Kantonskürzel;E;N;Sprache;Validity
          </li>
          <li>Required columns: BFS-Nr (externalId), E (longitude), N (latitude)</li>
          <li>Duplicate locations (same BFS-Nr) will be updated, not duplicated</li>
        </ul>
      </div>
    </div>
  );
}
