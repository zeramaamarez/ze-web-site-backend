'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/admin/data-table';
import { toast } from 'sonner';

interface PhotoItem {
  _id: string;
  title: string;
  date?: string;
  location?: string;
  images?: { url: string }[];
  published_at?: string | null;
}

interface PhotosResponse {
  data: PhotoItem[];
  pagination: {
    page: number;
    totalPages: number;
  };
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'true' | 'false'>('all');
  const [loading, setLoading] = useState(false);

  const fetchPhotos = async (params?: { page?: number; search?: string; published?: 'all' | 'true' | 'false' }) => {
    setLoading(true);
    const query = new URLSearchParams({ page: String(params?.page ?? page) });
    const searchValue = params?.search ?? search;
    if (searchValue) {
      query.set('search', searchValue);
    }
    const publishedValue = params?.published ?? publishedFilter;
    if (publishedValue !== 'all') {
      query.set('published', publishedValue);
    }

    const response = await fetch(`/api/photos?${query.toString()}`);
    setLoading(false);

    if (!response.ok) {
      toast.error('Erro ao carregar galerias');
      return;
    }

    const data = (await response.json()) as PhotosResponse;
    setPhotos(data.data);
    setPage(data.pagination.page);
    setTotalPages(data.pagination.totalPages);
  };

  useEffect(() => {
    fetchPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover esta galeria?')) return;
    const response = await fetch(`/api/photos/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Erro ao remover galeria');
      return;
    }
    toast.success('Galeria removida');
    fetchPhotos();
  };

  const columns: Column<PhotoItem>[] = [
    {
      key: 'images',
      header: 'Imagem',
      render: (item) =>
        item.images?.[0] ? (
          <Image src={item.images[0].url} alt={item.title} width={48} height={48} className="h-12 w-12 rounded object-cover" />
        ) : null
    },
    { key: 'title', header: 'Título' },
    { key: 'date', header: 'Data' },
    { key: 'location', header: 'Local' },
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
            <Link href={`/admin/photos/${item._id}`}>Editar</Link>
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
          <h1 className="text-2xl font-semibold">Fotos</h1>
          <p className="text-sm text-muted-foreground">Gerencie as galerias de fotos.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={publishedFilter}
            onValueChange={(value: 'all' | 'true' | 'false') => {
              setPublishedFilter(value);
              fetchPhotos({ page: 1, published: value });
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
            <Link href="/admin/photos/new">Nova galeria</Link>
          </Button>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={photos}
        page={page}
        totalPages={totalPages}
        onPageChange={(newPage) => {
          setPage(newPage);
          fetchPhotos({ page: newPage });
        }}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          fetchPhotos({ page: 1, search: value });
        }}
        emptyMessage={loading ? 'Carregando...' : 'Nenhuma galeria encontrada.'}
      />
    </div>
  );
}
