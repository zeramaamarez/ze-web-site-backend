'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/admin/data-table';
import { toast } from 'sonner';

interface BookItem {
  _id: string;
  title: string;
  author?: string;
  ISBN?: string;
  published_at?: string | null;
  cover?: {
    url: string;
  };
}

interface BooksResponse {
  data: BookItem[];
  pagination: {
    page: number;
    totalPages: number;
  };
}

export default function BooksPage() {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchBooks = async (params?: { page?: number; search?: string }) => {
    setLoading(true);
    const query = new URLSearchParams({
      page: String(params?.page ?? page),
      search: params?.search ?? search
    });
    const response = await fetch(`/api/books?${query.toString()}`);
    setLoading(false);

    if (!response.ok) {
      toast.error('Erro ao carregar livros');
      return;
    }

    const data = (await response.json()) as BooksResponse;
    setBooks(data.data);
    setPage(data.pagination.page);
    setTotalPages(data.pagination.totalPages);
  };

  useEffect(() => {
    fetchBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover este livro?')) return;
    const response = await fetch(`/api/books/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Erro ao remover livro');
      return;
    }
    toast.success('Livro removido');
    fetchBooks();
  };

  const columns: Column<BookItem>[] = [
    {
      key: 'cover',
      header: 'Capa',
      render: (item) =>
        item.cover ? <Image src={item.cover.url} alt={item.title} width={48} height={48} className="h-12 w-12 rounded object-cover" /> : null
    },
    { key: 'title', header: 'Título' },
    { key: 'author', header: 'Autor' },
    { key: 'ISBN', header: 'ISBN' },
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
            <Link href={`/admin/books/${item._id}`}>Editar</Link>
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
          <h1 className="text-2xl font-semibold">Livros</h1>
          <p className="text-sm text-muted-foreground">Gerencie os livros cadastrados.</p>
        </div>
        <Button asChild>
          <Link href="/admin/books/new">Novo livro</Link>
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={books}
        page={page}
        totalPages={totalPages}
        onPageChange={(newPage) => {
          setPage(newPage);
          fetchBooks({ page: newPage });
        }}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          fetchBooks({ page: 1, search: value });
        }}
        emptyMessage={loading ? 'Carregando...' : 'Nenhum livro encontrado.'}
      />
    </div>
  );
}
