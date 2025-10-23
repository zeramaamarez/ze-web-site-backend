import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import UsersPageClient from './users-page-client';

export default async function AdminUsersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/login');
  }

  if (session.user.role !== 'super_admin') {
    redirect('/admin');
  }

  return <UsersPageClient currentUserId={session.user.id ?? ''} />;
}
