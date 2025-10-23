'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/admin/data-table';
import { toast } from 'sonner';

interface MessageItem {
  _id: string;
  title: string;
  excerpt?: string;
  published_at?: string | null;
  cover?: { url: string } | null;
}

interface MessagesResponse {
  data: MessageItem[];
  pagination: {
    page: number;
    totalPages: number;
  };
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'true' | 'false'>('all');
  const [loading, setLoading] = useState(false);

  const fetchMessages = async (params?: { page?: number; search?: string; published?: 'all' | 'true' | 'false' }) => {
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

    const response = await fetch(`/api/messages?${query.toString()}`);
    setLoading(false);

    if (!response.ok) {
      toast.error('Erro ao carregar mensagens');
      return;
    }

    const data = (await response.json()) as MessagesResponse;
    setMessages(data.data);
    setPage(data.pagination.page);
    setTotalPages(data.pagination.totalPages);
  };

  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover esta mensagem?')) return;
    const response = await fetch(`/api/messages/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Erro ao remover mensagem');
      return;
    }
    toast.success('Mensagem removida');
    fetchMessages();
  };

  const columns: Column<MessageItem>[] = [
    {
      key: 'cover',
      header: 'Capa',
      render: (item) =>
        item.cover ? (
          <Image src={item.cover.url} alt={item.title} width={48} height={48} className="h-12 w-12 rounded object-cover" />
        ) : null
    },
    { key: 'title', header: 'Título' },
    { key: 'excerpt', header: 'Resumo' },
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
            <Link href={`/admin/messages/${item._id}`}>Editar</Link>
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
          <h1 className="text-2xl font-semibold">Mensagens</h1>
          <p className="text-sm text-muted-foreground">Gerencie as notícias e mensagens do site.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={publishedFilter}
            onValueChange={(value: 'all' | 'true' | 'false') => {
              setPublishedFilter(value);
              fetchMessages({ page: 1, published: value });
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
            <Link href="/admin/messages/new">Nova mensagem</Link>
          </Button>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={messages}
        page={page}
        totalPages={totalPages}
        onPageChange={(newPage) => {
          setPage(newPage);
          fetchMessages({ page: newPage });
        }}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          fetchMessages({ page: 1, search: value });
        }}
        emptyMessage={loading ? 'Carregando...' : 'Nenhuma mensagem encontrada.'}
      />
    </div>
  );
}
