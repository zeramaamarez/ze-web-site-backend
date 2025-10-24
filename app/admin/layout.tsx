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
    <div className="flex min-h-screen bg-gradient-to-br from-slate-100 via-white to-purple-50/40">
      <Sidebar role={session.user.role ?? 'admin'} name={session.user.name} email={session.user.email} />
      <div className="relative flex flex-1 flex-col">
        <Header name={session.user.name} email={session.user.email} role={session.user.role} />
        <main className="flex-1 overflow-y-auto px-8 py-10">
          <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
