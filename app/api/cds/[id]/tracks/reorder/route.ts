import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectMongo } from '@/lib/mongodb';
import CdModel from '@/lib/models/Cd';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';

const reorderSchema = z.object({
  order: z.array(z.string())
});

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const body = await request.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  await connectMongo();
  const cd = await CdModel.findById(params.id);
  if (!cd) {
    return NextResponse.json({ error: 'CD não encontrado' }, { status: 404 });
  }

  const order = parsed.data.order;
  const trackMap = new Map(cd.track?.map((item) => [item.ref?.toString(), item]));
  cd.track = order
    .map((id) => trackMap.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  cd.updated_by = authResult.session.user!.id;
  await cd.save();

  return NextResponse.json({ message: 'Ordem atualizada' });
}
