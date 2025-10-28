import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connectMongo } from '@/lib/mongodb';
import DvdModel from '@/lib/models/Dvd';
import { normalizeUploadFile } from '@/lib/legacy';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 12;

type DvdCard = {
  id: string;
  title: string;
  company?: string;
  release_date?: string;
  cover?: {
    url: string;
    name?: string;
  } | null;
  slug: string;
};

async function getDvds(page: number) {
  await connectMongo();
  const filter = { status: 'published', $or: [{ deleted: { $exists: false } }, { deleted: false }] };
  const [items, total] = await Promise.all([
    DvdModel.find(filter)
      .sort({ release_date: -1, title: 1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate('cover')
      .lean(),
    DvdModel.countDocuments(filter)
  ]);

  const dvds: DvdCard[] = items
    .map((item) => {
      const id = item._id?.toString();
      const slug = (item as { slug?: string }).slug;
      if (!id || !slug) {
        return null;
      }
      return {
        id,
        slug,
        title: item.title,
        company: item.company ?? undefined,
        release_date: item.release_date ?? undefined,
        cover: normalizeUploadFile(item.cover) as DvdCard['cover']
      } satisfies DvdCard;
    })
    .filter((card): card is DvdCard => Boolean(card));

  return {
    dvds,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE))
  };
}

function buildPageNumbers(current: number, total: number) {
  const pages: number[] = [];
  for (let i = 1; i <= total; i += 1) {
    pages.push(i);
  }
  return pages;
}

interface DvdPageProps {
  searchParams?: { page?: string };
}

export default async function DvdsPage({ searchParams }: DvdPageProps) {
  const currentPage = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1);
  const { dvds, total, totalPages } = await getDvds(currentPage);

  if (currentPage > totalPages && totalPages > 0) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">DVDs</h1>
        <p className="text-muted-foreground">Explore os DVDs publicados com registros raros e apresentações ao vivo.</p>
        <p className="text-sm text-muted-foreground">{total} DVD(s) encontrados.</p>
      </header>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {dvds.map((dvd) => (
          <article key={dvd.id} className="group overflow-hidden rounded-xl border bg-card shadow-sm transition hover:shadow-lg">
            <Link href={`/dvds/${dvd.slug}`} className="flex h-full flex-col">
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
                {dvd.cover?.url ? (
                  <Image
                    src={dvd.cover.url}
                    alt={dvd.cover.name || dvd.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem capa</div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h2 className="text-lg font-semibold line-clamp-2">{dvd.title}</h2>
                {dvd.company && <p className="text-sm text-muted-foreground line-clamp-1">{dvd.company}</p>}
                <div className="mt-auto text-xs text-muted-foreground">
                  {dvd.release_date ? `Lançado em ${dvd.release_date}` : 'Ano não informado'}
                </div>
              </div>
            </Link>
          </article>
        ))}
        {dvds.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            Nenhum DVD publicado até o momento.
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2">
          {buildPageNumbers(currentPage, totalPages).map((page) => (
            <Link
              key={page}
              href={page === 1 ? '/dvds' : `/dvds?page=${page}`}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border text-sm transition',
                page === currentPage
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary'
              )}
            >
              {page}
            </Link>
          ))}
        </nav>
      )}
    </main>
  );
}
