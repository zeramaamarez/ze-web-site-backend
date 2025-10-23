'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/admin/data-table';
import { toast } from 'sonner';

interface DvdItem {
  _id: string;
  title: string;
  company?: string;
  published_at?: string | null;
  track?: { ref: { name: string } }[];
  cover?: { url: string };
}

interface DvdResponse {
  data: DvdItem[];
  pagination: {
    page: number;
    totalPages: number;
  };
}

export default function DvdsPage() {
  const [dvds, setDvds] = useState<DvdItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchDvds = async (params?: { page?: number; search?: string }) => {
    setLoading(true);
    const query = new URLSearchParams({
      page: String(params?.page ?? page),
      search: params?.search ?? search
    });
    const response = await fetch(`/api/dvds?${query.toString()}`);
    setLoading(false);

    if (!response.ok) {
      toast.error('Erro ao carregar DVDs');
      return;
    }

    const data = (await response.json()) as DvdResponse;
    setDvds(data.data);
    setPage(data.pagination.page);
    setTotalPages(data.pagination.totalPages);
  };

  useEffect(() => {
    fetchDvds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover este DVD?')) return;
    const response = await fetch(`/api/dvds/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Erro ao remover DVD');
      return;
    }
    toast.success('DVD removido');
    fetchDvds();
  };

  const columns: Column<DvdItem>[] = [
    {
      key: 'cover',
      header: 'Capa',
      render: (item) =>
        item.cover ? <Image src={item.cover.url} alt={item.title} width={48} height={48} className="h-12 w-12 rounded object-cover" /> : null
    },
    { key: 'title', header: 'Título' },
    { key: 'company', header: 'Produtora' },
    {
      key: 'track',
      header: 'Faixas',
      render: (item) => item.track?.length || 0
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
            <Link href={`/admin/dvds/${item._id}`}>Editar</Link>
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
          <h1 className="text-2xl font-semibold">DVDs</h1>
          <p className="text-sm text-muted-foreground">Gerencie os DVDs e suas faixas.</p>
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
        onPageChange={(newPage) => {
          setPage(newPage);
          fetchDvds({ page: newPage });
        }}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          fetchDvds({ page: 1, search: value });
        }}
        emptyMessage={loading ? 'Carregando...' : 'Nenhum DVD encontrado.'}
      />
    </div>
  );
}
