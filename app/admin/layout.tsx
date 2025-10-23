import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/admin/sidebar';
import { Header } from '@/components/admin/header';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/login');
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={session.user.role ?? 'admin'} />
      <div className="flex flex-1 flex-col">
        <Header name={session.user.name} email={session.user.email} />
        <main className="flex-1 space-y-6 bg-muted/30 p-6">{children}</main>
      </div>
    </div>
  );
}
