'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/admin/data-table';
import { toast } from 'sonner';

interface LyricItem {
  _id: string;
  title: string;
  composers?: string;
  album?: string;
  year?: string;
  published_at?: string | null;
}

interface LyricsResponse {
  data: LyricItem[];
  pagination: {
    page: number;
    totalPages: number;
  };
}

export default function LyricsPage() {
  const [lyrics, setLyrics] = useState<LyricItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'true' | 'false'>('all');
  const [loading, setLoading] = useState(false);

  const fetchLyrics = async (params?: { page?: number; search?: string; published?: 'true' | 'false' | 'all' }) => {
    setLoading(true);
    const query = new URLSearchParams({
      page: String(params?.page ?? page),
    });
    const searchValue = params?.search ?? search;
    if (searchValue) {
      query.set('search', searchValue);
    }
    const publishedValue = params?.published ?? publishedFilter;
    if (publishedValue !== 'all') {
      query.set('published', publishedValue);
    }

    const response = await fetch(`/api/lyrics?${query.toString()}`);
    setLoading(false);

    if (!response.ok) {
      toast.error('Erro ao carregar letras');
      return;
    }

    const data = (await response.json()) as LyricsResponse;
    setLyrics(data.data);
    setPage(data.pagination.page);
    setTotalPages(data.pagination.totalPages);
  };

  useEffect(() => {
    fetchLyrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover esta letra?')) return;
    const response = await fetch(`/api/lyrics/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Erro ao remover letra');
      return;
    }
    toast.success('Letra removida');
    fetchLyrics();
  };

  const columns: Column<LyricItem>[] = [
    { key: 'title', header: 'Título' },
    { key: 'composers', header: 'Compositores' },
    { key: 'album', header: 'Álbum' },
    { key: 'year', header: 'Ano' },
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
            <Link href={`/admin/lyrics/${item._id}`}>Editar</Link>
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
          <h1 className="text-2xl font-semibold">Letras</h1>
          <p className="text-sm text-muted-foreground">Gerencie o catálogo de letras de músicas.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={publishedFilter}
            onValueChange={(value: 'all' | 'true' | 'false') => {
              setPublishedFilter(value);
              fetchLyrics({ page: 1, published: value });
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Publicação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Publicados</SelectItem>
              <SelectItem value="false">Rascunhos</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild>
            <Link href="/admin/lyrics/new">Nova letra</Link>
          </Button>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={lyrics}
        page={page}
        totalPages={totalPages}
        onPageChange={(newPage) => {
          setPage(newPage);
          fetchLyrics({ page: newPage });
        }}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          fetchLyrics({ page: 1, search: value });
        }}
        emptyMessage={loading ? 'Carregando...' : 'Nenhuma letra encontrada.'}
      />
    </div>
  );
}
