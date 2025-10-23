'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/admin/data-table';
import { toast } from 'sonner';

interface ClipItem {
  _id: string;
  title: string;
  url: string;
  published_at?: string | null;
  cover?: { url: string }[];
}

interface ClipsResponse {
  data: ClipItem[];
  pagination: {
    page: number;
    totalPages: number;
  };
}

export default function ClipsPage() {
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchClips = async (params?: { page?: number; search?: string }) => {
    setLoading(true);
    const query = new URLSearchParams({
      page: String(params?.page ?? page),
      search: params?.search ?? search
    });
    const response = await fetch(`/api/clips?${query.toString()}`);
    setLoading(false);

    if (!response.ok) {
      toast.error('Erro ao carregar clips');
      return;
    }

    const data = (await response.json()) as ClipsResponse;
    setClips(data.data);
    setPage(data.pagination.page);
    setTotalPages(data.pagination.totalPages);
  };

  useEffect(() => {
    fetchClips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover este clip?')) return;
    const response = await fetch(`/api/clips/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Erro ao remover clip');
      return;
    }
    toast.success('Clip removido');
    fetchClips();
  };

  const columns: Column<ClipItem>[] = [
    {
      key: 'cover',
      header: 'Imagem',
      render: (item) =>
        item.cover?.length ? (
          <div className="flex items-center gap-2">
            {item.cover.slice(0, 2).map((image, index) => (
              <Image key={index} src={image.url} alt={item.title} width={48} height={48} className="h-12 w-12 rounded object-cover" />
            ))}
          </div>
        ) : null
    },
    { key: 'title', header: 'Título' },
    {
      key: 'url',
      header: 'YouTube',
      render: (item) => (
        <a href={item.url} target="_blank" rel="noreferrer" className="text-primary underline">
          Abrir vídeo
        </a>
      )
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
            <Link href={`/admin/clips/${item._id}`}>Editar</Link>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clips</h1>
          <p className="text-sm text-muted-foreground">Gerencie os videoclipes.</p>
        </div>
        <Button asChild>
          <Link href="/admin/clips/new">Novo clip</Link>
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={clips}
        page={page}
        totalPages={totalPages}
        onPageChange={(newPage) => {
          setPage(newPage);
          fetchClips({ page: newPage });
        }}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          fetchClips({ page: 1, search: value });
        }}
        emptyMessage={loading ? 'Carregando...' : 'Nenhum clip encontrado.'}
      />
    </div>
  );
}
