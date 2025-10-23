import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import BookModel from '@/lib/models/Book';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const book = await BookModel.findById(params.id);
  if (!book) {
    return NextResponse.json({ error: 'Livro não encontrado' }, { status: 404 });
  }

  book.published_at = book.published_at ? null : new Date();
  book.updated_by = authResult.session.user!.id;
  await book.save();

  return NextResponse.json({ published_at: book.published_at });
}
