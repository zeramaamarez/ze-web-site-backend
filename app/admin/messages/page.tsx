'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { ColumnCustomizer } from '@/components/admin/column-customizer';
import { DataTable } from '@/components/admin/data-table';
import { useColumnPreferences, type ColumnOption } from '@/components/admin/hooks/use-column-preferences';
import { useVisibleColumns, type EnhancedColumn } from '@/components/admin/hooks/use-visible-columns';
import { resolveListResponse, type LegacyListResponse } from '@/components/admin/utils/list-response';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MessageItem {
  _id: string;
  name: string;
  email: string;
  city?: string;
  message?: string;
  response?: string;
  published_at?: string | null;
  createdAt?: string;
}

type MessagesResponse = LegacyListResponse<MessageItem>;

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const columnOptions: ColumnOption[] = [
  { key: '_id', label: 'ID', defaultVisible: false },
  { key: 'name', label: 'Nome', defaultVisible: true },
  { key: 'email', label: 'Email', defaultVisible: true },
  { key: 'city', label: 'Cidade', defaultVisible: false },
  { key: 'message', label: 'Mensagem', defaultVisible: true },
  { key: 'response', label: 'Resposta', defaultVisible: false },
  { key: 'published_at', label: 'Status', defaultVisible: true },
  { key: 'createdAt', label: 'Data de criação', defaultVisible: true },
  { key: 'actions', label: 'Ações', alwaysVisible: true }
];

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
};

const truncate = (value?: string, length = 80) => {
  if (!value) return '—';
  if (value.length <= length) return value;
  return `${value.slice(0, length)}…`;
};

export default function MessagesPage() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [cityFilter, setCityFilter] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(false);

  const columnPreferences = useColumnPreferences('table-columns-messages', columnOptions);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchMessages = useCallback(async () => {
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

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      if (cityFilter) {
        params.set('city', cityFilter);
      }

      const response = await fetch(`/api/messages?${params.toString()}`);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error || 'Erro ao carregar mensagens');
        return;
      }

      const payload = (await response.json()) as MessagesResponse | MessageItem[];
      const { items, pagination } = resolveListResponse(payload, pageSize, page);
      setMessages(items);
      setPage(pagination.page);
      setTotalPages(pagination.totalPages);
      setTotalItems(pagination.total);
    } catch (error) {
      console.error('Failed to load messages', error);
      toast.error('Erro ao carregar mensagens');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortKey, sortOrder, debouncedSearch, statusFilter, cityFilter]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Deseja remover esta mensagem?')) return;
      try {
        const response = await fetch(`/api/messages/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          toast.error(data?.error || 'Erro ao remover mensagem');
          return;
        }
        toast.success('Mensagem removida');
        if (messages.length <= 1 && page > 1) {
          setPage((current) => Math.max(1, current - 1));
        } else {
          await fetchMessages();
        }
      } catch (error) {
        console.error('Failed to delete message', error);
        toast.error('Erro ao remover mensagem');
      }
    },
    [messages.length, page, fetchMessages]
  );

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setCityFilter('');
    setPage(1);
  };

  const allColumns = useMemo<EnhancedColumn<MessageItem>[]>(
    () => [
      {
        key: '_id',
        label: 'ID',
        header: 'ID',
        defaultVisible: false,
        render: (item) => item._id
      },
      {
        key: 'name',
        label: 'Nome',
        header: 'Nome',
        sortable: true,
        defaultVisible: true,
        className: 'font-medium'
      },
      {
        key: 'email',
        label: 'Email',
        header: 'Email',
        defaultVisible: true,
        render: (item) => (
          <a href={`mailto:${item.email}`} className="text-primary underline underline-offset-4">
            {item.email}
          </a>
        )
      },
      {
        key: 'city',
        label: 'Cidade',
        header: 'Cidade',
        defaultVisible: false,
        render: (item) => item.city || '—'
      },
      {
        key: 'message',
        label: 'Mensagem',
        header: 'Mensagem',
        defaultVisible: true,
        render: (item) => truncate(item.message)
      },
      {
        key: 'response',
        label: 'Resposta',
        header: 'Resposta',
        defaultVisible: false,
        render: (item) => truncate(item.response, 60)
      },
      {
        key: 'published_at',
        label: 'Status',
        header: 'Status',
        align: 'center',
        defaultVisible: true,
        render: (item) => (
          <Badge className={item.published_at ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}>
            {item.published_at ? 'Published' : 'Draft'}
          </Badge>
        )
      },
      {
        key: 'createdAt',
        label: 'Criado em',
        header: 'Criado em',
        sortable: true,
        defaultVisible: true,
        render: (item) => formatDate(item.createdAt)
      },
      {
        key: 'actions',
        label: 'Ações',
        header: 'Ações',
        align: 'right',
        alwaysVisible: true,
        render: (item) => (
          <div className="flex items-center justify-end gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 px-3">
              <Link href={`/admin/messages/${item._id}`}>Editar</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-red-600 hover:text-red-700"
              onClick={() => void handleDelete(item._id)}
            >
              Remover
            </Button>
          </div>
        )
      }
    ],
    [handleDelete]
  );

  const visibleColumns = useVisibleColumns(allColumns, columnPreferences);

  const renderMobileCard = useCallback(
    (item: MessageItem) => (
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="space-y-2">
          <div>
            <h3 className="text-lg font-semibold leading-tight text-foreground">{item.name}</h3>
            <a href={`mailto:${item.email}`} className="text-sm text-primary underline underline-offset-4">
              {item.email}
            </a>
          </div>
          <p className="text-sm text-muted-foreground">{truncate(item.message)}</p>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {item.city && <span className="rounded-full bg-muted px-2 py-1">{item.city}</span>}
            <span className="rounded-full bg-muted px-2 py-1">{formatDate(item.createdAt)}</span>
            <Badge className={item.published_at ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}>
              {item.published_at ? 'Published' : 'Draft'}
            </Badge>
          </div>
          {item.response && (
            <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Resposta:</span> {truncate(item.response, 100)}
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Button asChild variant="outline" size="sm" className="h-8 px-3">
              <Link href={`/admin/messages/${item._id}`}>Editar</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-red-600 hover:text-red-700"
              onClick={() => void handleDelete(item._id)}
            >
              Remover
            </Button>
          </div>
        </div>
      </div>
    ),
    [handleDelete]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Mensagens</h1>
          <p className="text-sm text-muted-foreground">Gerencie as mensagens recebidas com personalização de colunas.</p>
        </div>
        <Button asChild className="shadow-lg shadow-primary/20">
          <Link href="/admin/messages/new">Nova mensagem</Link>
        </Button>
      </div>
      <DataTable
        columns={visibleColumns}
        data={messages}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        emptyMessage={isLoading ? 'Carregando mensagens...' : 'Nenhuma mensagem encontrada.'}
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
        renderMobileCard={renderMobileCard}
        toolbar={
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <ColumnCustomizer preferences={columnPreferences} />
              <Input
                value={cityFilter}
                onChange={(event) => {
                  setCityFilter(event.target.value);
                  setPage(1);
                }}
                placeholder="Filtrar por cidade"
                className="h-10 w-48"
              />
              <Select
                value={statusFilter}
                onValueChange={(value: typeof statusFilter) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40">
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
              <Button variant="outline" onClick={resetFilters} className="h-9 px-4">
                Limpar filtros
              </Button>
            </div>
          </div>
        }
      />
    </div>
  );
}
