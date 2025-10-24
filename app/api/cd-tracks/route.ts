import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import CdTrackModel from '@/lib/models/CdTrack';
import { cdTrackSchema } from '@/lib/validations/cd';
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
      { composers: { $regex: search, $options: 'i' } }
    ];
  }

  await connectMongo();
  const tracks = await CdTrackModel.find(filter).limit(limit).sort({ name: 1 }).lean();
  return NextResponse.json(tracks);
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  const body = await request.json();
  const parsed = cdTrackSchema.omit({ _id: true }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
  }

  await connectMongo();
  const track = await CdTrackModel.create(parsed.data);
  if (parsed.data.track) {
    await attachFile({ fileId: parsed.data.track, refId: track._id, kind: 'CdTrack', field: 'track' });
  }
  return NextResponse.json(track, { status: 201 });
}
