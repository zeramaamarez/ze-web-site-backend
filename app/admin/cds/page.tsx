'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/admin/data-table';

interface CdItem {
  _id: string;
  title: string;
  company?: string;
  release_date?: string;
  published_at?: string | null;
  cover?: { url: string } | null;
}

interface CdResponse {
  data: CdItem[];
  pagination: {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
  };
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export default function CdsPage() {
  const [cds, setCds] = useState<CdItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchCds = useCallback(async () => {
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

      if (companyFilter) {
        params.set('company', companyFilter);
      }

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`/api/cds?${params.toString()}`);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error || 'Erro ao carregar CDs');
        return;
      }

      const data = (await response.json()) as CdResponse;
      setCds(data.data);
      setPage(data.pagination.page || 1);
      setTotalPages(Math.max(1, data.pagination.totalPages || 1));
      setTotalItems(data.pagination.total || 0);
    } catch (error) {
      console.error('Failed to load cds', error);
      toast.error('Erro ao carregar CDs');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortKey, sortOrder, debouncedSearch, yearFilter, companyFilter, statusFilter]);

  useEffect(() => {
    void fetchCds();
  }, [fetchCds]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Deseja remover este CD?')) return;
      try {
        const response = await fetch(`/api/cds/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          toast.error(data?.error || 'Erro ao remover CD');
          return;
        }
        toast.success('CD removido');
        if (cds.length <= 1 && page > 1) {
          setPage((current) => Math.max(1, current - 1));
        } else {
          await fetchCds();
        }
      } catch (error) {
        console.error('Failed to delete cd', error);
        toast.error('Erro ao remover CD');
      }
    },
    [cds.length, page, fetchCds]
  );

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setYearFilter('');
    setCompanyFilter('');
    setStatusFilter('all');
    setPage(1);
  };

  const columns: Column<CdItem>[] = useMemo(
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
      { key: 'company', header: 'Gravadora', sortable: true },
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
        key: 'actions',
        header: 'Ações',
        align: 'right',
        render: (item) => (
          <div className="flex items-center justify-end gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/cds/${item._id}`}>Editar</Link>
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
          <h1 className="text-3xl font-semibold tracking-tight">CDs</h1>
          <p className="text-sm text-muted-foreground">Gerencie os álbuns com um painel profissional.</p>
        </div>
        <Button asChild>
          <Link href="/admin/cds/new">Novo CD</Link>
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={cds}
        page={page}
        totalPages={totalPages}
        onPageChange={(newPage) => setPage(newPage)}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        emptyMessage={isLoading ? 'Carregando CDs...' : 'Nenhum CD encontrado.'}
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
            <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                value={yearFilter}
                onChange={(event) => {
                  setYearFilter(event.target.value);
                  setPage(1);
                }}
                placeholder="Ano de lançamento"
              />
              <Input
                value={companyFilter}
                onChange={(event) => {
                  setCompanyFilter(event.target.value);
                  setPage(1);
                }}
                placeholder="Gravadora"
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
