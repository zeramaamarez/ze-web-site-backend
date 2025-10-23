'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/admin/data-table';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ShowItem {
  _id: string;
  title: string;
  date: string;
  time?: string;
  venue: string;
  city: string;
  state?: string;
  published_at?: string | null;
  isPast?: boolean;
}

interface ShowsResponse {
  data: ShowItem[];
  pagination: {
    page: number;
    totalPages: number;
  };
}

export default function ShowsPage() {
  const [shows, setShows] = useState<ShowItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'true' | 'false'>('all');
  const [cityFilter, setCityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchShows = async (params?: {
    page?: number;
    search?: string;
    status?: 'all' | 'upcoming' | 'past';
    published?: 'all' | 'true' | 'false';
    city?: string;
    state?: string;
  }) => {
    setLoading(true);
    const query = new URLSearchParams({ page: String(params?.page ?? page) });
    const searchValue = params?.search ?? search;
    if (searchValue) {
      query.set('search', searchValue);
    }
    const statusValue = params?.status ?? statusFilter;
    if (statusValue !== 'all') {
      query.set('status', statusValue);
    }
    const publishedValue = params?.published ?? publishedFilter;
    if (publishedValue !== 'all') {
      query.set('published', publishedValue);
    }
    const cityValue = params?.city ?? cityFilter;
    if (cityValue) {
      query.set('city', cityValue);
    }
    const stateValue = params?.state ?? stateFilter;
    if (stateValue) {
      query.set('state', stateValue);
    }

    const response = await fetch(`/api/shows?${query.toString()}`);
    setLoading(false);

    if (!response.ok) {
      toast.error('Erro ao carregar shows');
      return;
    }

    const data = (await response.json()) as ShowsResponse;
    setShows(data.data);
    setPage(data.pagination.page);
    setTotalPages(data.pagination.totalPages);
  };

  useEffect(() => {
    fetchShows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover este show?')) return;
    const response = await fetch(`/api/shows/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Erro ao remover show');
      return;
    }
    toast.success('Show removido');
    fetchShows();
  };

  const columns: Column<ShowItem>[] = [
    { key: 'title', header: 'Título' },
    {
      key: 'date',
      header: 'Data',
      render: (item) => format(new Date(item.date), "dd/MM/yyyy")
    },
    { key: 'city', header: 'Cidade' },
    { key: 'venue', header: 'Local' },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (item.isPast ? 'Realizado' : 'Próximo')
    },
    {
      key: 'published_at',
      header: 'Publicado',
      render: (item) => (item.published_at ? 'Sim' : 'Não')
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (item) => (
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/shows/${item._id}`}>Editar</Link>
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(item._id)}>
            Remover
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Shows</h1>
          <p className="text-sm text-muted-foreground">Gerencie a agenda de shows.</p>
        </div>
        <Button asChild>
          <Link href="/admin/shows/new">Novo show</Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Select
          value={statusFilter}
          onValueChange={(value: 'all' | 'upcoming' | 'past') => {
            setStatusFilter(value);
            fetchShows({ page: 1, status: value });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="upcoming">Próximos</SelectItem>
            <SelectItem value="past">Realizados</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={publishedFilter}
          onValueChange={(value: 'all' | 'true' | 'false') => {
            setPublishedFilter(value);
            fetchShows({ page: 1, published: value });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Publicação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Publicados</SelectItem>
            <SelectItem value="false">Rascunhos</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Filtrar por cidade"
          value={cityFilter}
          onChange={(event) => setCityFilter(event.target.value)}
          onBlur={() => fetchShows({ page: 1, city: cityFilter })}
        />
        <Input
          placeholder="Filtrar por estado"
          value={stateFilter}
          onChange={(event) => setStateFilter(event.target.value)}
          onBlur={() => fetchShows({ page: 1, state: stateFilter })}
        />
      </div>
      <DataTable
        columns={columns}
        data={shows}
        page={page}
        totalPages={totalPages}
        onPageChange={(newPage) => {
          setPage(newPage);
          fetchShows({ page: newPage });
        }}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          fetchShows({ page: 1, search: value });
        }}
        emptyMessage={loading ? 'Carregando...' : 'Nenhum show encontrado.'}
      />
    </div>
  );
}
