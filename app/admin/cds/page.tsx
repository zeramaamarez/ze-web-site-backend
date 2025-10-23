'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/admin/data-table';
import { toast } from 'sonner';

interface CdItem {
  _id: string;
  title: string;
  company?: string;
  published_at?: string | null;
  track?: { ref: { name: string } }[];
  cover?: { url: string };
}

interface CdResponse {
  data: CdItem[];
  pagination: {
    page: number;
    totalPages: number;
  };
}

export default function CdsPage() {
  const [cds, setCds] = useState<CdItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchCds = async (params?: { page?: number; search?: string }) => {
    setLoading(true);
    const query = new URLSearchParams({
      page: String(params?.page ?? page),
      search: params?.search ?? search
    });
    const response = await fetch(`/api/cds?${query.toString()}`);
    setLoading(false);

    if (!response.ok) {
      toast.error('Erro ao carregar CDs');
      return;
    }

    const data = (await response.json()) as CdResponse;
    setCds(data.data);
    setPage(data.pagination.page);
    setTotalPages(data.pagination.totalPages);
  };

  useEffect(() => {
    fetchCds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover este CD?')) return;
    const response = await fetch(`/api/cds/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Erro ao remover CD');
      return;
    }
    toast.success('CD removido');
    fetchCds();
  };

  const columns: Column<CdItem>[] = [
    {
      key: 'cover',
      header: 'Capa',
      render: (item) =>
        item.cover ? <Image src={item.cover.url} alt={item.title} width={48} height={48} className="h-12 w-12 rounded object-cover" /> : null
    },
    { key: 'title', header: 'Título' },
    { key: 'company', header: 'Gravadora' },
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
            <Link href={`/admin/cds/${item._id}`}>Editar</Link>
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
          <h1 className="text-2xl font-semibold">CDs</h1>
          <p className="text-sm text-muted-foreground">Gerencie os CDs e suas faixas.</p>
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
        onPageChange={(newPage) => {
          setPage(newPage);
          fetchCds({ page: newPage });
        }}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          fetchCds({ page: 1, search: value });
        }}
        emptyMessage={loading ? 'Carregando...' : 'Nenhum CD encontrado.'}
      />
    </div>
  );
}
