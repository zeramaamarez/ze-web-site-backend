import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import LyricModel from '@/lib/models/Lyric';
import { lyricSchema } from '@/lib/validations/lyric';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const lyric = await LyricModel.findById(params.id).lean();
  if (!lyric) {
    return NextResponse.json({ error: 'Letra não encontrada' }, { status: 404 });
  }

  return NextResponse.json(lyric);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = lyricSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();
    const lyric = await LyricModel.findById(params.id);
    if (!lyric) {
      return NextResponse.json({ error: 'Letra não encontrada' }, { status: 404 });
    }

    Object.assign(lyric, parsed.data, { updated_by: authResult.session.user!.id });
    await lyric.save();

    return NextResponse.json(await LyricModel.findById(lyric._id).lean());
  } catch (error) {
    console.error('Lyric update error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const lyric = await LyricModel.findById(params.id);
  if (!lyric) {
    return NextResponse.json({ error: 'Letra não encontrada' }, { status: 404 });
  }

  await lyric.deleteOne();
  return NextResponse.json({ message: 'Letra removida' });
}
