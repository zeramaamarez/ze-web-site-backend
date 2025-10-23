import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectMongo } from '@/lib/mongodb';
import DvdModel from '@/lib/models/Dvd';
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
  const dvd = await DvdModel.findById(params.id);
  if (!dvd) {
    return NextResponse.json({ error: 'DVD não encontrado' }, { status: 404 });
  }

  const map = new Map(dvd.track?.map((item) => [item.ref?.toString(), item]));
  dvd.track = parsed.data.order
    .map((id) => map.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  dvd.updated_by = authResult.session.user!.id;
  await dvd.save();

  return NextResponse.json({ message: 'Ordem atualizada' });
}
