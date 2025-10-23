import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { auth } from '@/lib/auth';

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    } as const;
  }

  if (session.user.role !== 'admin' && session.user.role !== 'super_admin') {
    return {
      session,
      response: NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    } as const;
  }

  return { session } as const;
}

type RequireSuperAdminResult = { session: Session } | NextResponse;

export async function requireSuperAdmin(): Promise<RequireSuperAdminResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  return { session };
}
