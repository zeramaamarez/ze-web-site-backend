import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import DvdTrackModel from '@/lib/models/DvdTrack';
import { dvdTrackSchema } from '@/lib/validations/dvd';
import { requireAdmin } from '@/lib/api';
import { attachFile } from '@/lib/upload';

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);

  const filter: Record<string, unknown> = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { composers: { $regex: search, $options: 'i' } },
      { label: { $regex: search, $options: 'i' } }
    ];
  }

  await connectMongo();
  const tracks = await DvdTrackModel.find(filter).limit(limit).sort({ name: 1 }).lean();
  return NextResponse.json(tracks);
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  const body = await request.json();
  const parsed = dvdTrackSchema.omit({ _id: true }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
  }

  await connectMongo();
  const track = await DvdTrackModel.create({
    name: parsed.data.name,
    composers: parsed.data.composers,
    label: parsed.data.label,
    time: parsed.data.time,
    lyric: parsed.data.lyric,
    track: parsed.data.track || undefined
  });
  if (parsed.data.track) {
    await attachFile({ fileId: parsed.data.track, refId: track._id, kind: 'DvdTrack', field: 'track' });
  }
  return NextResponse.json(track, { status: 201 });
}
