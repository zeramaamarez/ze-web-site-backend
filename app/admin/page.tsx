import mongoose, { Model } from 'mongoose';

import { connectMongo } from '@/lib/mongodb';
import BookModel from '@/lib/models/Book';
import CdModel from '@/lib/models/Cd';
import DvdModel from '@/lib/models/Dvd';
import ClipModel from '@/lib/models/Clip';
import LyricModel from '@/lib/models/Lyric';
import MessageModel from '@/lib/models/Message';
import PhotoModel from '@/lib/models/Photo';
import ShowModel from '@/lib/models/Show';
import TextModel from '@/lib/models/Text';
import { getCloudinaryUsage } from '@/lib/cloudinary';
import { DashboardContent } from './_components/dashboard-content';

type LatestDocument = { title?: string | null; updatedAt?: Date | null };

async function fetchLatest(model: Model<Record<string, unknown>>, type: string) {
  const documents = (await model
    .find()
    .sort({ updatedAt: -1 })
    .limit(5)
    .select('title updatedAt')
    .lean()) as LatestDocument[];

  return documents.map((doc) => ({
    title: (doc as { title?: string }).title ?? 'Sem título',
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : null,
    type
  }));
}

async function getStats() {
  await connectMongo();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not initialized');
  }

  const [
    booksTotal,
    booksPublished,
    cdsTotal,
    cdsPublished,
    dvdsTotal,
    dvdsPublished,
    clipsTotal,
    clipsPublished,
    lyricsTotal,
    lyricsPublished,
    messagesTotal,
    messagesPublished,
    photosTotal,
    photosPublished,
    showsTotal,
    showsPublished,
    textsTotal,
    textsPublished,
    cdComponentTracks,
    dvdComponentTracks
  ] = await Promise.all([
    BookModel.countDocuments(),
    BookModel.countDocuments({ published_at: { $ne: null } }),
    CdModel.countDocuments(),
    CdModel.countDocuments({ published_at: { $ne: null } }),
    DvdModel.countDocuments(),
    DvdModel.countDocuments({ published_at: { $ne: null } }),
    ClipModel.countDocuments(),
    ClipModel.countDocuments({ published_at: { $ne: null } }),
    LyricModel.countDocuments(),
    LyricModel.countDocuments({ published_at: { $ne: null } }),
    MessageModel.countDocuments(),
    MessageModel.countDocuments({ published_at: { $ne: null } }),
    PhotoModel.countDocuments(),
    PhotoModel.countDocuments({ published_at: { $ne: null } }),
    ShowModel.countDocuments(),
    ShowModel.countDocuments({ published_at: { $ne: null } }),
    TextModel.countDocuments(),
    TextModel.countDocuments({ published_at: { $ne: null } }),
    db.collection('components_cd_tracks').countDocuments(),
    db.collection('components_dvd_tracks').countDocuments()
  ]);

  const latest = (
    await Promise.all([
      fetchLatest(BookModel, 'books'),
      fetchLatest(CdModel, 'cds'),
      fetchLatest(DvdModel, 'dvds'),
      fetchLatest(ClipModel, 'clips'),
      fetchLatest(LyricModel, 'lyrics'),
      fetchLatest(MessageModel, 'messages'),
      fetchLatest(PhotoModel, 'photos'),
      fetchLatest(ShowModel, 'shows'),
      fetchLatest(TextModel, 'texts')
    ])
  )
    .flat()
    .sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  const cloudinaryUsage = await getCloudinaryUsage().catch(() => null);

  return {
    books: { total: booksTotal, published: booksPublished },
    cds: { total: cdsTotal, published: cdsPublished },
    dvds: { total: dvdsTotal, published: dvdsPublished },
    clips: { total: clipsTotal, published: clipsPublished },
    lyrics: { total: lyricsTotal, published: lyricsPublished },
    messages: { total: messagesTotal, published: messagesPublished },
    photos: { total: photosTotal, published: photosPublished },
    shows: { total: showsTotal, published: showsPublished },
    texts: { total: textsTotal, published: textsPublished },
    tracks: {
      cds: cdComponentTracks,
      dvds: dvdComponentTracks,
      total: cdComponentTracks + dvdComponentTracks
    },
    latest,
    cloudinary: cloudinaryUsage
      ? {
          storage: cloudinaryUsage.storage,
          bandwidth: cloudinaryUsage.bandwidth,
          resources: cloudinaryUsage.resources,
          lastUpdated: cloudinaryUsage.lastUpdated ?? null
        }
      : null
  } as const;
}

export default async function AdminDashboardPage() {
  const stats = await getStats();

  return <DashboardContent stats={stats} />;
}
