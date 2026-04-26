import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/getCurrentUser';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/projects');

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
        <nav className="flex gap-1 text-sm">
          <AdminTab href="/admin/users">Users</AdminTab>
          <AdminTab href="/admin/projects">Projects</AdminTab>
        </nav>
      </header>
      <div>{children}</div>
    </div>
  );
}

function AdminTab({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    >
      {children}
    </Link>
  );
}
