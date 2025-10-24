'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { Images } from 'lucide-react';
import { toast } from 'sonner';

import { ColumnCustomizer } from '@/components/admin/column-customizer';
import { DataTable } from '@/components/admin/data-table';
import { useColumnPreferences, type ColumnOption } from '@/components/admin/hooks/use-column-preferences';
import { useVisibleColumns, type EnhancedColumn } from '@/components/admin/hooks/use-visible-columns';
import { resolveListResponse, type LegacyListResponse } from '@/components/admin/utils/list-response';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PhotoItem {
  _id: string;
  title: string;
  album?: string;
  date?: string;
  location?: string;
  images?: { url: string }[];
  published_at?: string | null;
  createdAt?: string;
}

type PhotosResponse = LegacyListResponse<PhotoItem>;

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const columnOptions: ColumnOption[] = [
  { key: 'images', label: 'Thumbnail', defaultVisible: true },
  { key: 'title', label: 'Título', defaultVisible: true },
  { key: 'album', label: 'Álbum', defaultVisible: false },
  { key: 'date', label: 'Data', defaultVisible: true },
  { key: 'location', label: 'Local', defaultVisible: false },
  { key: 'published_at', label: 'Publicado', defaultVisible: true },
  { key: 'createdAt', label: 'Criado em', defaultVisible: false },
  { key: 'actions', label: 'Ações', alwaysVisible: true }
];

const formatDate = (value?: string) => {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd/MM/yyyy');
  } catch (error) {
    console.warn('Failed to format date', error);
    return '—';
  }
};

export default function PhotosPage() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [albumFilter, setAlbumFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(false);

  const columnPreferences = useColumnPreferences('table-columns-photos', columnOptions);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchPhotos = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort: sortKey,
        order: sortOrder
      });

      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      if (albumFilter) {
        params.set('album', albumFilter);
      }

      if (locationFilter) {
        params.set('location', locationFilter);
      }

      const response = await fetch(`/api/photos?${params.toString()}`);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error || 'Erro ao carregar galerias');
        return;
      }

      const payload = (await response.json()) as PhotosResponse | PhotoItem[];
      const { items, pagination } = resolveListResponse(payload, pageSize, page);
      setPhotos(items);
      setPage(pagination.page);
      setTotalPages(pagination.totalPages);
      setTotalItems(pagination.total);
    } catch (error) {
      console.error('Failed to load photos', error);
      toast.error('Erro ao carregar galerias');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortKey, sortOrder, debouncedSearch, statusFilter, albumFilter, locationFilter]);

  useEffect(() => {
    void fetchPhotos();
  }, [fetchPhotos]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Deseja remover esta galeria?')) return;
      try {
        const response = await fetch(`/api/photos/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          toast.error(data?.error || 'Erro ao remover galeria');
          return;
        }
        toast.success('Galeria removida');
        if (photos.length <= 1 && page > 1) {
          setPage((current) => Math.max(1, current - 1));
        } else {
          await fetchPhotos();
        }
      } catch (error) {
        console.error('Failed to delete gallery', error);
        toast.error('Erro ao remover galeria');
      }
    },
    [photos.length, page, fetchPhotos]
  );

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setAlbumFilter('');
    setLocationFilter('');
    setPage(1);
  };

  const allColumns = useMemo<EnhancedColumn<PhotoItem>[]>(
    () => [
      {
        key: 'images',
        label: 'Thumbnail',
        header: 'Imagem',
        align: 'center',
        defaultVisible: true,
        render: (item) =>
          item.images?.[0]?.url ? (
            <Image
              src={item.images[0].url}
              alt={item.title}
              width={64}
              height={64}
              className="h-16 w-16 rounded-xl object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed bg-muted/50">
              <Images className="h-6 w-6 text-muted-foreground" />
            </div>
          )
      },
      {
        key: 'title',
        label: 'Título',
        header: 'Título',
        sortable: true,
        defaultVisible: true,
        className: 'font-medium'
      },
      {
        key: 'album',
        label: 'Álbum',
        header: 'Álbum',
        defaultVisible: false,
        render: (item) => item.album || '—'
      },
      {
        key: 'date',
        label: 'Data',
        header: 'Data',
        sortable: true,
        defaultVisible: true,
        render: (item) => formatDate(item.date)
      },
      {
        key: 'location',
        label: 'Local',
        header: 'Local',
        defaultVisible: false,
        render: (item) => item.location || '—'
      },
      {
        key: 'published_at',
        label: 'Publicado',
        header: 'Publicado',
        align: 'center',
        defaultVisible: true,
        render: (item) => (
          <Badge className={item.published_at ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}>
            {item.published_at ? 'Published' : 'Draft'}
          </Badge>
        )
      },
      {
        key: 'createdAt',
        label: 'Criado em',
        header: 'Criado em',
        sortable: true,
        defaultVisible: false,
        render: (item) => formatDate(item.createdAt)
      },
      {
        key: 'actions',
        label: 'Ações',
        header: 'Ações',
        align: 'right',
        alwaysVisible: true,
        render: (item) => (
          <div className="flex items-center justify-end gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 px-3">
              <Link href={`/admin/photos/${item._id}`}>Editar</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-red-600 hover:text-red-700"
              onClick={() => void handleDelete(item._id)}
            >
              Remover
            </Button>
          </div>
        )
      }
    ],
    [handleDelete]
  );

  const visibleColumns = useVisibleColumns(allColumns, columnPreferences);

  const renderMobileCard = useCallback(
    (item: PhotoItem) => (
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {item.images?.[0]?.url ? (
            <Image
              src={item.images[0].url}
              alt={item.title}
              width={320}
              height={200}
              className="h-32 w-full rounded-xl object-cover shadow-sm sm:h-20 sm:w-32"
            />
          ) : (
            <div className="flex h-32 w-full items-center justify-center rounded-xl border border-dashed bg-muted/50 text-muted-foreground sm:h-20 sm:w-32">
              <Images className="h-6 w-6" />
            </div>
          )}
          <div className="flex-1 space-y-2">
            <div>
              <h3 className="text-lg font-semibold leading-tight text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground">
                {item.album ? `Álbum: ${item.album}` : 'Álbum não informado'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {item.date && <span className="rounded-full bg-muted px-2 py-1">{formatDate(item.date)}</span>}
              {item.location && <span className="rounded-full bg-muted px-2 py-1">{item.location}</span>}
              <Badge className={item.published_at ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}>
                {item.published_at ? 'Published' : 'Draft'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button asChild variant="outline" size="sm" className="h-8 px-3">
                <Link href={`/admin/photos/${item._id}`}>Editar</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-red-600 hover:text-red-700"
                onClick={() => void handleDelete(item._id)}
              >
                Remover
              </Button>
            </div>
          </div>
        </div>
      </div>
    ),
    [handleDelete]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Fotos</h1>
          <p className="text-sm text-muted-foreground">Gerencie as galerias de fotos com filtros e colunas personalizadas.</p>
        </div>
        <Button asChild className="shadow-lg shadow-primary/20">
          <Link href="/admin/photos/new">Nova galeria</Link>
        </Button>
      </div>
      <DataTable
        columns={visibleColumns}
        data={photos}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        emptyMessage={isLoading ? 'Carregando galerias...' : 'Nenhuma galeria encontrada.'}
        isLoading={isLoading}
        pageSize={pageSize}
        pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
        onPageSizeChange={(value) => {
          setPageSize(value as typeof PAGE_SIZE_OPTIONS[number]);
          setPage(1);
        }}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSortChange={(key, order) => {
          setSortKey(key);
          setSortOrder(order);
          setPage(1);
        }}
        totalItems={totalItems}
        renderMobileCard={renderMobileCard}
        toolbar={
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <ColumnCustomizer preferences={columnPreferences} />
              <Input
                value={albumFilter}
                onChange={(event) => {
                  setAlbumFilter(event.target.value);
                  setPage(1);
                }}
                placeholder="Filtrar por álbum"
                className="h-10 w-48"
              />
              <Input
                value={locationFilter}
                onChange={(event) => {
                  setLocationFilter(event.target.value);
                  setPage(1);
                }}
                placeholder="Filtrar por local"
                className="h-10 w-48"
              />
              <Select
                value={statusFilter}
                onValueChange={(value: typeof statusFilter) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={resetFilters} className="h-9 px-4">
                Limpar filtros
              </Button>
            </div>
          </div>
        }
      />
    </div>
  );
}
