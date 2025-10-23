import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import BookModel from '@/lib/models/Book';
import { bookSchema } from '@/lib/validations/book';
import { requireAdmin } from '@/lib/api';
import { attachFile, detachFile, deleteFileIfOrphan } from '@/lib/upload';
import { isObjectId } from '@/lib/utils';

async function findBook(id: string) {
  await connectMongo();
  return BookModel.findById(id).populate('cover');
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const book = await findBook(params.id);
  if (!book) {
    return NextResponse.json({ error: 'Livro não encontrado' }, { status: 404 });
  }

  return NextResponse.json(book);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = bookSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();
    const existing = await BookModel.findById(params.id);
    if (!existing) {
      return NextResponse.json({ error: 'Livro não encontrado' }, { status: 404 });
    }

    const previousCover = existing.cover?.toString();

    Object.assign(existing, parsed.data, {
      updated_by: authResult.session.user!.id
    });

    await existing.save();

    if (parsed.data.cover && parsed.data.cover !== previousCover) {
      await attachFile({ fileId: parsed.data.cover, refId: existing._id, kind: 'Book', field: 'cover' });
      await detachFile(previousCover, existing._id);
      await deleteFileIfOrphan(previousCover);
    }

    return NextResponse.json(await BookModel.findById(existing._id).populate('cover').lean());
  } catch (error) {
    console.error('Book update error', error);
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
  const book = await BookModel.findById(params.id);
  if (!book) {
    return NextResponse.json({ error: 'Livro não encontrado' }, { status: 404 });
  }

  const coverId = book.cover?.toString();
  await book.deleteOne();
  if (coverId) {
    await detachFile(coverId, book._id);
    await deleteFileIfOrphan(coverId);
  }

  return NextResponse.json({ message: 'Livro removido' });
}
