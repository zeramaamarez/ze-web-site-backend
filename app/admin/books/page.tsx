'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { ImageIcon } from 'lucide-react';
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

interface BookItem {
  _id: string;
  title: string;
  author?: string;
  ISBN?: string;
  publisher?: string;
  published_at?: string | null;
  createdAt?: string;
  updatedAt?: string;
  cover?: {
    url: string;
  } | null;
}

type BooksResponse = LegacyListResponse<BookItem>;

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const columnOptions: ColumnOption[] = [
  { key: 'cover', label: 'Capa', defaultVisible: false },
  { key: 'title', label: 'Título', defaultVisible: true },
  { key: 'author', label: 'Autor', defaultVisible: false },
  { key: 'ISBN', label: 'ISBN', defaultVisible: false },
  { key: 'publisher', label: 'Editora', defaultVisible: false },
  { key: 'published_at', label: 'Publicado', defaultVisible: true },
  { key: 'createdAt', label: 'Criado em', defaultVisible: false },
  { key: 'updatedAt', label: 'Atualizado em', defaultVisible: false },
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

export default function BooksPage() {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [yearFilter, setYearFilter] = useState('');
  const [publisherFilter, setPublisherFilter] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(false);

  const columnPreferences = useColumnPreferences('table-columns-books', columnOptions);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchBooks = useCallback(async () => {
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

      if (publisherFilter) {
        params.set('publisher', publisherFilter);
      }

      const response = await fetch(`/api/books?${params.toString()}`);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error || 'Erro ao carregar livros');
        return;
      }

      const payload = (await response.json()) as BooksResponse | BookItem[];
      const { items, pagination } = resolveListResponse(payload, pageSize, page);
      setBooks(items);
      setPage(pagination.page);
      setTotalPages(pagination.totalPages);
      setTotalItems(pagination.total);
    } catch (error) {
      console.error('Failed to load books', error);
      toast.error('Erro ao carregar livros');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortKey, sortOrder, debouncedSearch, statusFilter, yearFilter, publisherFilter]);

  useEffect(() => {
    void fetchBooks();
  }, [fetchBooks]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Deseja remover este livro?')) return;
      try {
        const response = await fetch(`/api/books/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          toast.error(data?.error || 'Erro ao remover livro');
          return;
        }
        toast.success('Livro removido');
        if (books.length <= 1 && page > 1) {
          setPage((current) => Math.max(1, current - 1));
        } else {
          await fetchBooks();
        }
      } catch (error) {
        console.error('Failed to delete book', error);
        toast.error('Erro ao remover livro');
      }
    },
    [books.length, page, fetchBooks]
  );

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setYearFilter('');
    setPublisherFilter('');
    setPage(1);
  };

  const allColumns = useMemo<EnhancedColumn<BookItem>[]>(
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
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
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
        key: 'author',
        label: 'Autor',
        header: 'Autor',
        sortable: true,
        defaultVisible: false
      },
      {
        key: 'ISBN',
        label: 'ISBN',
        header: 'ISBN',
        defaultVisible: false
      },
      {
        key: 'publisher',
        label: 'Editora',
        header: 'Editora',
        defaultVisible: false
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
        render: (item) => formatDate(item.createdAt)
      },
      {
        key: 'updatedAt',
        label: 'Atualizado em',
        header: 'Atualizado em',
        sortable: true,
        defaultVisible: false,
        render: (item) => formatDate(item.updatedAt)
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
              <Link href={`/admin/books/${item._id}`}>Editar</Link>
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
    (item: BookItem) => (
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
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl border border-dashed bg-muted/50">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 space-y-2">
            <div>
              <h3 className="text-lg font-semibold leading-tight text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground">
                {item.author ? `Autor: ${item.author}` : 'Autor não informado'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {item.ISBN && <span className="rounded-full bg-muted px-2 py-1">ISBN {item.ISBN}</span>}
              {item.publisher && <span className="rounded-full bg-muted px-2 py-1">{item.publisher}</span>}
              <Badge className={item.published_at ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}>
                {item.published_at ? 'Published' : 'Draft'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button asChild variant="outline" size="sm" className="h-8 px-3">
                <Link href={`/admin/books/${item._id}`}>Editar</Link>
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
          <h1 className="text-3xl font-semibold tracking-tight">Livros</h1>
          <p className="text-sm text-muted-foreground">Gerencie sua biblioteca com visual profissional e colunas personalizáveis.</p>
        </div>
        <Button asChild className="shadow-lg shadow-primary/20">
          <Link href="/admin/books/new">Novo livro</Link>
        </Button>
      </div>
      <DataTable
        columns={visibleColumns}
        data={books}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        emptyMessage={isLoading ? 'Carregando livros...' : 'Nenhum livro encontrado.'}
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
                placeholder="Ano de publicação"
                className="h-10 w-48"
              />
              <Input
                value={publisherFilter}
                onChange={(event) => {
                  setPublisherFilter(event.target.value);
                  setPage(1);
                }}
                placeholder="Filtrar por editora"
                className="h-10 w-56"
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
