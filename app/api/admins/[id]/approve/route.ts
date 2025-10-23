import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireSuperAdmin } from '@/lib/api';
import { connectMongo } from '@/lib/mongodb';
import AdminModel from '@/lib/models/Admin';

type RouteContext = {
  params: { id: string };
};

export async function PATCH(_request: Request, { params }: RouteContext) {
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { session } = authResult;
  const approverId = session.user?.id;
  if (!approverId) {
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

  if (admin.approved) {
    await admin.populate('approvedBy', 'name email role');
    return NextResponse.json({ message: 'Usuário já está aprovado', admin: admin.toObject() });
  }

  admin.approved = true;
  admin.approvedBy = approverId;
  admin.approvedAt = new Date();
  await admin.save();
  await admin.populate('approvedBy', 'name email role');

  return NextResponse.json({ message: 'Usuário aprovado com sucesso', admin: admin.toObject() });
}
