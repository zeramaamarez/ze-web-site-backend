import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import CdTrackModel from '@/lib/models/CdTrack';
import { cdTrackSchema } from '@/lib/validations/cd';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const track = await CdTrackModel.findById(params.id).lean();
  if (!track) {
    return NextResponse.json({ error: 'Faixa não encontrada' }, { status: 404 });
  }

  return NextResponse.json(track);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const body = await request.json();
  const parsed = cdTrackSchema.omit({ _id: true }).partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
  }

  await connectMongo();
  const track = await CdTrackModel.findByIdAndUpdate(params.id, parsed.data, { new: true }).lean();
  if (!track) {
    return NextResponse.json({ error: 'Faixa não encontrada' }, { status: 404 });
  }

  return NextResponse.json(track);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  await CdTrackModel.findByIdAndDelete(params.id);
  return NextResponse.json({ message: 'Faixa removida' });
}
