'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/admin/data-table';

interface DvdItem {
  _id: string;
  title: string;
  release_date?: string;
  published_at?: string | null;
  cover?: { url: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

interface DvdResponse {
  data: DvdItem[];
  pagination: {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
  };
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

function formatDate(value?: string) {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd/MM/yyyy');
  } catch (error) {
    console.error('Failed to format date', error);
    return '—';
  }
}

export default function DvdsPage() {
  const [dvds, setDvds] = useState<DvdItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchDvds = useCallback(async () => {
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

      if (yearFilter) {
        params.set('year', yearFilter);
      }

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`/api/dvds?${params.toString()}`);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error || 'Erro ao carregar DVDs');
        return;
      }

      const data = (await response.json()) as DvdResponse;
      setDvds(data.data);
      setPage(data.pagination.page || 1);
      setTotalPages(Math.max(1, data.pagination.totalPages || 1));
      setTotalItems(data.pagination.total || 0);
    } catch (error) {
      console.error('Failed to load dvds', error);
      toast.error('Erro ao carregar DVDs');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortKey, sortOrder, debouncedSearch, yearFilter, statusFilter]);

  useEffect(() => {
    void fetchDvds();
  }, [fetchDvds]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Deseja remover este DVD?')) return;
      try {
        const response = await fetch(`/api/dvds/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          toast.error(data?.error || 'Erro ao remover DVD');
          return;
        }
        toast.success('DVD removido');
        if (dvds.length <= 1 && page > 1) {
          setPage((current) => Math.max(1, current - 1));
        } else {
          await fetchDvds();
        }
      } catch (error) {
        console.error('Failed to delete dvd', error);
        toast.error('Erro ao remover DVD');
      }
    },
    [dvds.length, page, fetchDvds]
  );

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setYearFilter('');
    setStatusFilter('all');
    setPage(1);
  };

  const columns: Column<DvdItem>[] = useMemo(
    () => [
      {
        key: 'cover',
        header: 'Capa',
        align: 'center',
        render: (item) => (
          item.cover ? (
            <Image src={item.cover.url} alt={item.title} width={48} height={48} className="h-12 w-12 rounded object-cover" />
          ) : (
            <div className="h-12 w-12 rounded border border-dashed" />
          )
        )
      },
      { key: 'title', header: 'Título', sortable: true },
      { key: 'release_date', header: 'Lançamento', sortable: true },
      {
        key: 'published_at',
        header: 'Status',
        align: 'center',
        render: (item) => (
          <Badge variant={item.published_at ? 'success' : 'warning'}>
            {item.published_at ? 'Published' : 'Draft'}
          </Badge>
        )
      },
      {
        key: 'createdAt',
        header: 'Criado em',
        sortable: true,
        render: (item) => formatDate(item.createdAt)
      },
      {
        key: 'updatedAt',
        header: 'Atualizado em',
        sortable: true,
        render: (item) => formatDate(item.updatedAt)
      },
      {
        key: 'actions',
        header: 'Ações',
        align: 'right',
        render: (item) => (
          <div className="flex items-center justify-end gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/dvds/${item._id}`}>Editar</Link>
            </Button>
            <Button variant="destructive" size="sm" onClick={() => void handleDelete(item._id)}>
              Remover
            </Button>
          </div>
        )
      }
    ],
    [handleDelete]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">DVDs</h1>
          <p className="text-sm text-muted-foreground">Visual profissional para gerenciar a discografia em vídeo.</p>
        </div>
        <Button asChild>
          <Link href="/admin/dvds/new">Novo DVD</Link>
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={dvds}
        page={page}
        totalPages={totalPages}
        onPageChange={(newPage) => setPage(newPage)}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        emptyMessage={isLoading ? 'Carregando DVDs...' : 'Nenhum DVD encontrado.'}
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
        toolbar={
          <div className="flex flex-col gap-3 rounded-md border bg-card p-4 shadow-sm md:flex-row md:items-end md:justify-between">
            <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                value={yearFilter}
                onChange={(event) => {
                  setYearFilter(event.target.value);
                  setPage(1);
                }}
                placeholder="Ano de lançamento"
              />
              <Select
                value={statusFilter}
                onValueChange={(value: typeof statusFilter) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger>
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
              <Button variant="outline" onClick={resetFilters}>
                Limpar filtros
              </Button>
            </div>
          </div>
        }
      />
    </div>
  );
}
