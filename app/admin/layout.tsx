import { AdminGuard } from '@/components/admin/AdminGuard';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background border-b-2 border-slate-200 dark:border-slate-800">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <nav className="flex gap-4">
                <Link href="/admin" className="text-sm hover:underline">
                  Dashboard
                </Link>
                <Link href="/admin/locations" className="text-sm hover:underline">
                  Locations
                </Link>
                <Link href="/" className="text-sm hover:underline">
                  Back to App
                </Link>
              </nav>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">{children}</main>
      </div>
    </AdminGuard>
  );
}

