import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    } as const;
  }

  if (session.user.role !== 'admin') {
    return {
      session,
      response: NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    } as const;
  }

  return { session } as const;
}
