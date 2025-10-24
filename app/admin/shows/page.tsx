'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { MapPin, ImageIcon } from 'lucide-react';
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

interface ShowItem {
  _id: string;
  title: string;
  date: string;
  time?: string;
  venue: string;
  city: string;
  state?: string;
  banner?: { url: string } | null;
  cover?: { url: string } | null;
  published_at?: string | null;
  isPast?: boolean;
}

type ShowsResponse = LegacyListResponse<ShowItem>;

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const columnOptions: ColumnOption[] = [
  { key: 'banner', label: 'Banner', defaultVisible: false },
  { key: 'title', label: 'Show', defaultVisible: true },
  { key: 'date', label: 'Data', defaultVisible: true },
  { key: 'city', label: 'Cidade', defaultVisible: true },
  { key: 'venue', label: 'Local', defaultVisible: false },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'published_at', label: 'Publicado', defaultVisible: true },
  { key: 'actions', label: 'Ações', alwaysVisible: true }
];

const formatDate = (value: string) => {
  try {
    return format(new Date(value), 'dd/MM/yyyy');
  } catch (error) {
    console.warn('Failed to format date', error);
    return '—';
  }
};

export default function ShowsPage() {
  const [shows, setShows] = useState<ShowItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [cityFilter, setCityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [sortKey, setSortKey] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isLoading, setIsLoading] = useState(false);

  const columnPreferences = useColumnPreferences('table-columns-shows', columnOptions);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchShows = useCallback(async () => {
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

      if (publishedFilter !== 'all') {
        params.set('published', publishedFilter);
      }

      if (cityFilter) {
        params.set('city', cityFilter);
      }

      if (stateFilter) {
        params.set('state', stateFilter);
      }

      const response = await fetch(`/api/shows?${params.toString()}`);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error || 'Erro ao carregar shows');
        return;
      }

      const payload = (await response.json()) as ShowsResponse | ShowItem[];
      const { items, pagination } = resolveListResponse(payload, pageSize, page);
      setShows(items);
      setPage(pagination.page);
      setTotalPages(pagination.totalPages);
      setTotalItems(pagination.total);
    } catch (error) {
      console.error('Failed to load shows', error);
      toast.error('Erro ao carregar shows');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortKey, sortOrder, debouncedSearch, statusFilter, publishedFilter, cityFilter, stateFilter]);

  useEffect(() => {
    void fetchShows();
  }, [fetchShows]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Deseja remover este show?')) return;
      try {
        const response = await fetch(`/api/shows/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          toast.error(data?.error || 'Erro ao remover show');
          return;
        }
        toast.success('Show removido');
        if (shows.length <= 1 && page > 1) {
          setPage((current) => Math.max(1, current - 1));
        } else {
          await fetchShows();
        }
      } catch (error) {
        console.error('Failed to delete show', error);
        toast.error('Erro ao remover show');
      }
    },
    [shows.length, page, fetchShows]
  );

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setPublishedFilter('all');
    setCityFilter('');
    setStateFilter('');
    setPage(1);
  };

  const allColumns = useMemo<EnhancedColumn<ShowItem>[]>(
    () => [
      {
        key: 'banner',
        label: 'Banner',
        header: 'Banner',
        align: 'center',
        defaultVisible: false,
        render: (item) => {
          const image = item.banner ?? item.cover;
          return image?.url ? (
            <Image
              src={image.url}
              alt={item.title}
              width={64}
              height={64}
              className="h-16 w-16 rounded-xl object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed bg-muted/50">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          );
        }
      },
      {
        key: 'title',
        label: 'Show',
        header: 'Show',
        sortable: true,
        defaultVisible: true,
        render: (item) => (
          <div>
            <p className="font-medium text-foreground">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.venue}</p>
          </div>
        )
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
        key: 'city',
        label: 'Cidade',
        header: 'Cidade',
        sortable: true,
        defaultVisible: true,
        render: (item) => (
          <div className="flex items-center gap-1 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>
              {item.city}
              {item.state ? `, ${item.state}` : ''}
            </span>
          </div>
        )
      },
      {
        key: 'status',
        label: 'Status',
        header: 'Status',
        align: 'center',
        defaultVisible: true,
        render: (item) => (
          <Badge className={item.isPast ? 'bg-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-100'}>
            {item.isPast ? 'Realizado' : 'Próximo'}
          </Badge>
        )
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
        key: 'actions',
        label: 'Ações',
        header: 'Ações',
        align: 'right',
        alwaysVisible: true,
        render: (item) => (
          <div className="flex items-center justify-end gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 px-3">
              <Link href={`/admin/shows/${item._id}`}>Editar</Link>
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
    (item: ShowItem) => {
      const image = item.banner ?? item.cover;
      return (
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              {image?.url ? (
                <Image
                  src={image.url}
                  alt={item.title}
                  width={64}
                  height={64}
                  className="h-16 w-16 flex-shrink-0 rounded-xl object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl border border-dashed bg-muted/50">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            <div className="flex-1 space-y-1">
              <h3 className="text-lg font-semibold leading-tight text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.venue}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-1">{formatDate(item.date)}</span>
            <span className="rounded-full bg-muted px-2 py-1">
              {item.city}
              {item.state ? `, ${item.state}` : ''}
            </span>
            <Badge className={item.isPast ? 'bg-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-100'}>
              {item.isPast ? 'Realizado' : 'Próximo'}
            </Badge>
            <Badge className={item.published_at ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}>
              {item.published_at ? 'Published' : 'Draft'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button asChild variant="outline" size="sm" className="h-8 px-3">
              <Link href={`/admin/shows/${item._id}`}>Editar</Link>
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
      );
    },
    [handleDelete]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Shows</h1>
          <p className="text-sm text-muted-foreground">Gerencie a agenda de shows com filtros inteligentes.</p>
        </div>
        <Button asChild className="shadow-lg shadow-primary/20">
          <Link href="/admin/shows/new">Novo show</Link>
        </Button>
      </div>
      <DataTable
        columns={visibleColumns}
        data={shows}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        emptyMessage={isLoading ? 'Carregando shows...' : 'Nenhum show encontrado.'}
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
              <Select
                value={statusFilter}
                onValueChange={(value: typeof statusFilter) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Status do show" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="upcoming">Próximos</SelectItem>
                  <SelectItem value="past">Realizados</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={publishedFilter}
                onValueChange={(value: typeof publishedFilter) => {
                  setPublishedFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Status de publicação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={cityFilter}
                onChange={(event) => {
                  setCityFilter(event.target.value);
                  setPage(1);
                }}
                placeholder="Filtrar por cidade"
                className="h-10 w-48"
              />
              <Input
                value={stateFilter}
                onChange={(event) => {
                  setStateFilter(event.target.value);
                  setPage(1);
                }}
                placeholder="Filtrar por estado"
                className="h-10 w-32"
              />
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
