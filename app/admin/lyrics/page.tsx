'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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

interface LyricItem {
  _id: string;
  title: string;
  composers?: string;
  album?: string;
  year?: string;
  published_at?: string | null;
  createdAt?: string;
}

type LyricsResponse = LegacyListResponse<LyricItem>;

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const columnOptions: ColumnOption[] = [
  { key: 'title', label: 'Título', defaultVisible: true },
  { key: 'composers', label: 'Compositor', defaultVisible: true },
  { key: 'year', label: 'Ano', defaultVisible: false },
  { key: 'album', label: 'Álbum', defaultVisible: false },
  { key: 'published_at', label: 'Publicado', defaultVisible: true },
  { key: 'createdAt', label: 'Criado em', defaultVisible: false },
  { key: 'actions', label: 'Ações', alwaysVisible: true }
];

export default function LyricsPage() {
  const [lyrics, setLyrics] = useState<LyricItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [yearFilter, setYearFilter] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(false);

  const columnPreferences = useColumnPreferences('table-columns-lyrics', columnOptions);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchLyrics = useCallback(async () => {
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

      if (yearFilter) {
        params.set('year', yearFilter);
      }

      const response = await fetch(`/api/lyrics?${params.toString()}`);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error || 'Erro ao carregar letras');
        return;
      }

      const payload = (await response.json()) as LyricsResponse | LyricItem[];
      const { items, pagination } = resolveListResponse(payload, pageSize, page);
      setLyrics(items);
      setPage(pagination.page);
      setTotalPages(pagination.totalPages);
      setTotalItems(pagination.total);
    } catch (error) {
      console.error('Failed to load lyrics', error);
      toast.error('Erro ao carregar letras');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortKey, sortOrder, debouncedSearch, statusFilter, yearFilter]);

  useEffect(() => {
    void fetchLyrics();
  }, [fetchLyrics]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Deseja remover esta letra?')) return;
      try {
        const response = await fetch(`/api/lyrics/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          toast.error(data?.error || 'Erro ao remover letra');
          return;
        }
        toast.success('Letra removida');
        if (lyrics.length <= 1 && page > 1) {
          setPage((current) => Math.max(1, current - 1));
        } else {
          await fetchLyrics();
        }
      } catch (error) {
        console.error('Failed to delete lyric', error);
        toast.error('Erro ao remover letra');
      }
    },
    [lyrics.length, page, fetchLyrics]
  );

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setYearFilter('');
    setPage(1);
  };

  const allColumns = useMemo<EnhancedColumn<LyricItem>[]>(
    () => [
      {
        key: 'title',
        label: 'Título',
        header: 'Título',
        sortable: true,
        defaultVisible: true,
        className: 'font-medium'
      },
      {
        key: 'composers',
        label: 'Compositor',
        header: 'Compositor',
        sortable: true,
        defaultVisible: true,
        render: (item) => item.composers || '—'
      },
      {
        key: 'year',
        label: 'Ano',
        header: 'Ano',
        sortable: true,
        defaultVisible: false,
        render: (item) => item.year || '—'
      },
      {
        key: 'album',
        label: 'Álbum',
        header: 'Álbum',
        defaultVisible: false,
        render: (item) => item.album || '—'
      },
      {
        key: 'published_at',
        label: 'Publicado',
        header: 'Status',
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
        render: (item) => (item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : '—')
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
              <Link href={`/admin/lyrics/${item._id}`}>Editar</Link>
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
    (item: LyricItem) => (
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="space-y-2">
          <div>
            <h3 className="text-lg font-semibold leading-tight text-foreground">{item.title}</h3>
            <p className="text-sm text-muted-foreground">
              {item.composers ? `Compositor: ${item.composers}` : 'Compositor não informado'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {item.album && <span className="rounded-full bg-muted px-2 py-1">Álbum {item.album}</span>}
            {item.year && <span className="rounded-full bg-muted px-2 py-1">Ano {item.year}</span>}
            <Badge className={item.published_at ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}>
              {item.published_at ? 'Published' : 'Draft'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button asChild variant="outline" size="sm" className="h-8 px-3">
              <Link href={`/admin/lyrics/${item._id}`}>Editar</Link>
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
    ),
    [handleDelete]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Letras</h1>
          <p className="text-sm text-muted-foreground">Gerencie o catálogo de letras com campos completos e filtros avançados.</p>
        </div>
        <Button asChild className="shadow-lg shadow-primary/20">
          <Link href="/admin/lyrics/new">Nova letra</Link>
        </Button>
      </div>
      <DataTable
        columns={visibleColumns}
        data={lyrics}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        emptyMessage={isLoading ? 'Carregando letras...' : 'Nenhuma letra encontrada.'}
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
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <ColumnCustomizer preferences={columnPreferences} />
              <Input
                value={yearFilter}
                onChange={(event) => {
                  setYearFilter(event.target.value);
                  setPage(1);
                }}
                placeholder="Ano"
                className="h-10 w-32"
              />
              <Select
                value={statusFilter}
                onValueChange={(value: typeof statusFilter) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40">
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
