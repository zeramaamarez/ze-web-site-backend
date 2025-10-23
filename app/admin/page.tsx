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
import CdTrackModel from '@/lib/models/CdTrack';
import DvdTrackModel from '@/lib/models/DvdTrack';
import { getCloudinaryUsage } from '@/lib/cloudinary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatDataSize(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  const gigabytes = megabytes / 1024;

  if (gigabytes >= 1) {
    return {
      primary: `${gigabytes.toFixed(2)} GB`,
      secondary: `${megabytes.toFixed(2)} MB`
    } as const;
  }

  return {
    primary: `${megabytes.toFixed(2)} MB`,
    secondary: null
  } as const;
}

async function getStats() {
  await connectMongo();

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
    cdTracks,
    dvdTracks
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
    CdTrackModel.countDocuments(),
    DvdTrackModel.countDocuments()
  ]);

  const latest = await Promise.all([
    BookModel.find().sort({ updatedAt: -1 }).limit(5).select('title updatedAt').lean(),
    CdModel.find().sort({ updatedAt: -1 }).limit(5).select('title updatedAt').lean(),
    DvdModel.find().sort({ updatedAt: -1 }).limit(5).select('title updatedAt').lean(),
    ClipModel.find().sort({ updatedAt: -1 }).limit(5).select('title updatedAt').lean(),
    LyricModel.find().sort({ updatedAt: -1 }).limit(5).select('title updatedAt').lean(),
    MessageModel.find().sort({ updatedAt: -1 }).limit(5).select('title updatedAt').lean(),
    PhotoModel.find().sort({ updatedAt: -1 }).limit(5).select('title updatedAt').lean(),
    ShowModel.find().sort({ updatedAt: -1 }).limit(5).select('title updatedAt').lean(),
    TextModel.find().sort({ updatedAt: -1 }).limit(5).select('title updatedAt').lean()
  ]);

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
    tracks: cdTracks + dvdTracks,
    latest: latest
      .flat()
      .sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0))
      .slice(0, 5),
    cloudinary: cloudinaryUsage
  };
}

export default async function AdminDashboardPage() {
  const stats = await getStats();

  const storageBytes = stats.cloudinary?.storage.usage ?? 0;
  const bandwidthBytes = stats.cloudinary?.bandwidth.usage ?? 0;
  const resourceCount = stats.cloudinary?.resources.usage ?? 0;

  const storageDisplay = formatDataSize(storageBytes);
  const bandwidthDisplay = formatDataSize(bandwidthBytes);

  const storageSupplement = storageDisplay.secondary
    ? ` (${storageDisplay.secondary})`
    : '';
  const bandwidthSupplement = bandwidthDisplay.secondary
    ? ` (${bandwidthDisplay.secondary})`
    : '';

  const formattedResourceCount = new Intl.NumberFormat('pt-BR').format(
    resourceCount
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Livros</CardTitle>
            <CardDescription>
              {stats.books.published} publicados de {stats.books.total}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>CDs</CardTitle>
            <CardDescription>
              {stats.cds.published} publicados de {stats.cds.total}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>DVDs</CardTitle>
            <CardDescription>
              {stats.dvds.published} publicados de {stats.dvds.total}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Clips</CardTitle>
            <CardDescription>
              {stats.clips.published} publicados de {stats.clips.total}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Letras</CardTitle>
            <CardDescription>
              {stats.lyrics.published} publicadas de {stats.lyrics.total}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mensagens</CardTitle>
            <CardDescription>
              {stats.messages.published} publicadas de {stats.messages.total}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fotos</CardTitle>
            <CardDescription>
              {stats.photos.published} publicadas de {stats.photos.total}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Shows</CardTitle>
            <CardDescription>
              {stats.shows.published} publicados de {stats.shows.total}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Textos</CardTitle>
            <CardDescription>
              {stats.texts.published} publicados de {stats.texts.total}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total de faixas</CardTitle>
            <CardDescription>{stats.tracks} faixas cadastradas</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Armazenamento Cloudinary</CardTitle>
            <CardDescription>
              {stats.cloudinary
                ? `${storageDisplay.primary} utilizados${storageSupplement}`
                : 'Dados indisponíveis'}
            </CardDescription>
          </CardHeader>
          {stats.cloudinary ? (
            <CardContent>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Arquivos: {formattedResourceCount}</p>
                <p>
                  Largura de banda: {bandwidthDisplay.primary}
                  {bandwidthSupplement}
                </p>
              </div>
            </CardContent>
          ) : null}
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Últimas atualizações</CardTitle>
          <CardDescription>Itens atualizados recentemente</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {stats.latest.map((item, index) => (
              <li key={index} className="flex items-center justify-between text-sm">
                <span>{(item as { title?: string }).title || 'Sem título'}</span>
                <span className="text-muted-foreground">
                  {item.updatedAt
                    ? format(item.updatedAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : 'N/A'}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
