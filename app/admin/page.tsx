'use client';

import Link from 'next/link';

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-4">Admin Dashboard</h2>
        <p className="text-muted-foreground">Manage your application settings and data.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <AdminCard
          title="Locations"
          description="Import and manage location data from CSV files"
          href="/admin/locations"
        />
        <AdminCard
          title="Sources"
          description="Manage event sources (municipal websites, PDFs, APIs)"
          href="/admin/sources"
        />
      </div>
    </div>
  );
}

function AdminCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link href={href}>
      <div className="p-6 border-2 border-slate-200 dark:border-slate-800 rounded-lg hover:border-slate-400 dark:hover:border-slate-600 transition-colors">
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
