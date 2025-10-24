'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';

import { ColumnCustomizer } from '@/components/admin/column-customizer';
import { DataTable } from '@/components/admin/data-table';
import { useColumnPreferences, type ColumnOption } from '@/components/admin/hooks/use-column-preferences';
import { useVisibleColumns, type EnhancedColumn } from '@/components/admin/hooks/use-visible-columns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TextItem {
  _id: string;
  title: string;
  category?: string;
  author?: string;
  published_at?: string | null;
  createdAt?: string;
  cover?: { url: string } | null;
}

interface TextsResponse {
  data: TextItem[];
  pagination: {
    page: number;
    totalPages: number;
    total?: number;
  };
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const columnOptions: ColumnOption[] = [
  { key: 'cover', label: 'Capa', defaultVisible: false },
  { key: 'title', label: 'Título', defaultVisible: true },
  { key: 'category', label: 'Categoria', defaultVisible: true },
  { key: 'author', label: 'Autor', defaultVisible: false },
  { key: 'published_at', label: 'Publicado', defaultVisible: true },
  { key: 'createdAt', label: 'Criado em', defaultVisible: false },
  { key: 'actions', label: 'Ações', alwaysVisible: true }
];

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
};

export default function TextsPage() {
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(false);

  const columnPreferences = useColumnPreferences('table-columns-texts', columnOptions);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchTexts = useCallback(async () => {
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

      if (categoryFilter) {
        params.set('category', categoryFilter);
      }

      const response = await fetch(`/api/texts?${params.toString()}`);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error || 'Erro ao carregar textos');
        return;
      }

      const data = (await response.json()) as TextsResponse;
      setTexts(data.data);
      setPage(data.pagination.page || 1);
      setTotalPages(Math.max(1, data.pagination.totalPages || 1));
      setTotalItems(data.pagination.total ?? data.data.length);
    } catch (error) {
      console.error('Failed to load texts', error);
      toast.error('Erro ao carregar textos');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortKey, sortOrder, debouncedSearch, statusFilter, categoryFilter]);

  useEffect(() => {
    void fetchTexts();
  }, [fetchTexts]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Deseja remover este texto?')) return;
      try {
        const response = await fetch(`/api/texts/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          toast.error(data?.error || 'Erro ao remover texto');
          return;
        }
        toast.success('Texto removido');
        if (texts.length <= 1 && page > 1) {
          setPage((current) => Math.max(1, current - 1));
        } else {
          await fetchTexts();
        }
      } catch (error) {
        console.error('Failed to delete text', error);
        toast.error('Erro ao remover texto');
      }
    },
    [texts.length, page, fetchTexts]
  );

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setCategoryFilter('');
    setPage(1);
  };

  const allColumns = useMemo<EnhancedColumn<TextItem>[]>(
    () => [
      {
        key: 'cover',
        label: 'Capa',
        header: 'Capa',
        align: 'center',
        defaultVisible: false,
        render: (item) =>
          item.cover?.url ? (
            <Image
              src={item.cover.url}
              alt={item.title}
              width={64}
              height={64}
              className="h-16 w-16 rounded-xl object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed bg-muted/50">
              <span className="text-xs text-muted-foreground">Sem capa</span>
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
        key: 'category',
        label: 'Categoria',
        header: 'Categoria',
        sortable: true,
        defaultVisible: true,
        render: (item) => item.category || '—'
      },
      {
        key: 'author',
        label: 'Autor',
        header: 'Autor',
        defaultVisible: false,
        render: (item) => item.author || '—'
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
              <Link href={`/admin/texts/${item._id}`}>Editar</Link>
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
    (item: TextItem) => (
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          {item.cover?.url ? (
            <Image
              src={item.cover.url}
              alt={item.title}
              width={64}
              height={64}
              className="h-16 w-16 flex-shrink-0 rounded-xl object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl border border-dashed bg-muted/50 text-xs text-muted-foreground">
              Sem capa
            </div>
          )}
          <div className="flex-1 space-y-2">
            <div>
              <h3 className="text-lg font-semibold leading-tight text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground">
                {item.category ? `Categoria: ${item.category}` : 'Categoria não informada'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {item.author && <span className="rounded-full bg-muted px-2 py-1">Autor {item.author}</span>}
              <span className="rounded-full bg-muted px-2 py-1">{formatDate(item.createdAt)}</span>
              <Badge className={item.published_at ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}>
                {item.published_at ? 'Published' : 'Draft'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button asChild variant="outline" size="sm" className="h-8 px-3">
                <Link href={`/admin/texts/${item._id}`}>Editar</Link>
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
          <h1 className="text-3xl font-semibold tracking-tight">Textos</h1>
          <p className="text-sm text-muted-foreground">Gerencie os textos e artigos com colunas configuráveis.</p>
        </div>
        <Button asChild className="shadow-lg shadow-primary/20">
          <Link href="/admin/texts/new">Novo texto</Link>
        </Button>
      </div>
      <DataTable
        columns={visibleColumns}
        data={texts}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        emptyMessage={isLoading ? 'Carregando textos...' : 'Nenhum texto encontrado.'}
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
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value);
                  setPage(1);
                }}
                placeholder="Filtrar por categoria"
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
