import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import DvdTrackModel from '@/lib/models/DvdTrack';
import { dvdTrackSchema } from '@/lib/validations/dvd';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';
import { attachFile, detachFile, deleteFileIfOrphan } from '@/lib/upload';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const track = await DvdTrackModel.findById(params.id).lean();
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
  const parsed = dvdTrackSchema.omit({ _id: true }).partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
  }

  await connectMongo();
  const track = await DvdTrackModel.findById(params.id);
  if (!track) {
    return NextResponse.json({ error: 'Faixa não encontrada' }, { status: 404 });
  }

  const previousAudio = track.track?.toString();
  if (parsed.data.name !== undefined) track.name = parsed.data.name;
  if (parsed.data.composers !== undefined) track.composers = parsed.data.composers;
  if (parsed.data.label !== undefined) track.label = parsed.data.label;
  if (parsed.data.time !== undefined) track.time = parsed.data.time;
  if (parsed.data.lyric !== undefined) track.lyric = parsed.data.lyric;

  if (Object.prototype.hasOwnProperty.call(parsed.data, 'track')) {
    track.track = parsed.data.track || undefined;
  }

  await track.save();

  if (Object.prototype.hasOwnProperty.call(parsed.data, 'track')) {
    const newTrackId = parsed.data.track ?? undefined;
    if (newTrackId && newTrackId !== previousAudio) {
      await attachFile({ fileId: newTrackId, refId: track._id, kind: 'DvdTrack', field: 'track' });
      await detachFile(previousAudio, track._id);
      await deleteFileIfOrphan(previousAudio, {
        reason: 'track_deleted',
        relatedTo: `DvdTrack:${track._id.toString()}`,
        userId: authResult.session.user!.id
      });
    } else if (!newTrackId && previousAudio) {
      await detachFile(previousAudio, track._id);
      await deleteFileIfOrphan(previousAudio, {
        reason: 'track_deleted',
        relatedTo: `DvdTrack:${track._id.toString()}`,
        userId: authResult.session.user!.id
      });
    }
  }

  return NextResponse.json(await DvdTrackModel.findById(params.id).lean());
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const track = await DvdTrackModel.findById(params.id);
  if (!track) {
    return NextResponse.json({ error: 'Faixa não encontrada' }, { status: 404 });
  }

  const audioId = track.track?.toString();
  await track.deleteOne();
  if (audioId) {
    await detachFile(audioId, track._id);
    await deleteFileIfOrphan(audioId, {
      reason: 'track_deleted',
      relatedTo: `DvdTrack:${track._id.toString()}`,
      userId: authResult.session.user!.id
    });
  }

  return NextResponse.json({ message: 'Faixa removida' });
}
