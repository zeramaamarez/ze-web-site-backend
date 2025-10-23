import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireSuperAdmin } from '@/lib/api';
import { connectMongo } from '@/lib/mongodb';
import AdminModel from '@/lib/models/Admin';

type RouteContext = {
  params: { id: string };
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { session } = authResult;
  const currentAdminId = session.user?.id;
  if (!currentAdminId) {
    return NextResponse.json({ error: 'Administrador inválido' }, { status: 400 });
  }

  const { id } = params;

  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();

  const admin = await AdminModel.findById(id);
  if (!admin) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  if (admin._id.toString() === currentAdminId) {
    return NextResponse.json({ error: 'Não é possível remover seu próprio usuário' }, { status: 400 });
  }

  await admin.deleteOne();

  return NextResponse.json({ message: 'Usuário removido com sucesso' });
}
