'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/admin/data-table';
import { toast } from 'sonner';

type AdminRole = 'admin' | 'super_admin';

type AdminItem = {
  _id: string;
  name: string;
  email: string;
  role: AdminRole;
  approved: boolean;
  approvedAt?: string | null;
  approvedBy?: {
    _id: string;
    name?: string | null;
    email?: string | null;
  } | null;
  createdAt?: string;
};

type FilterValue = 'all' | 'pending' | 'approved';

interface UsersPageClientProps {
  currentUserId: string;
}

export default function UsersPageClient({ currentUserId }: UsersPageClientProps) {
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [loading, setLoading] = useState(false);

  const fetchAdmins = useCallback(async (status: FilterValue) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status === 'pending') {
      params.set('status', 'pending');
    } else if (status === 'approved') {
      params.set('status', 'approved');
    }

    const queryString = params.toString();

    try {
      const response = await fetch(`/api/admins${queryString ? `?${queryString}` : ''}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast.error((errorData as { error?: string }).error || 'Erro ao carregar usuários');
        return;
      }

      const data = (await response.json()) as { data?: AdminItem[] };
      setAdmins(data.data ?? []);
    } catch (error) {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins(filter);
  }, [fetchAdmins, filter]);

  const handleApprove = async (id: string) => {
    const response = await fetch(`/api/admins/${id}/approve`, { method: 'PATCH' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string; message?: string }).error || (data as { message?: string }).message || 'Erro ao aprovar usuário');
      return;
    }

    toast.success('Usuário aprovado com sucesso');
    fetchAdmins(filter);
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Deseja remover este usuário?')) {
      return;
    }

    const response = await fetch(`/api/admins/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao remover usuário');
      return;
    }

    toast.success('Usuário removido com sucesso');
    fetchAdmins(filter);
  };

  const columns: Column<AdminItem>[] = [
    {
      key: 'name',
      header: 'Usuário',
      render: (item) => (
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-muted-foreground">{item.email}</p>
        </div>
      )
    },
    {
      key: 'role',
      header: 'Função',
      render: (item) => (item.role === 'super_admin' ? 'Super administrador' : 'Administrador')
    },
    {
      key: 'approved',
      header: 'Status',
      render: (item) => (item.approved ? 'Aprovado' : 'Pendente')
    },
    {
      key: 'approvedAt',
      header: 'Aprovado em',
      render: (item) => (item.approvedAt ? new Date(item.approvedAt).toLocaleString('pt-BR') : '-')
    },
    {
      key: 'approvedBy',
      header: 'Aprovado por',
      render: (item) => (item.approved && item.approvedBy ? item.approvedBy.name || item.approvedBy.email : '-')
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (item) => (
        <div className="flex flex-wrap items-center gap-2">
          {!item.approved && (
            <Button size="sm" onClick={() => handleApprove(item._id)}>
              Aprovar
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleRemove(item._id)}
            disabled={item._id === currentUserId}
          >
            Remover
          </Button>
        </div>
      )
    }
  ];

  const filterOptions: { label: string; value: FilterValue }[] = [
    { label: 'Todos', value: 'all' },
    { label: 'Pendentes', value: 'pending' },
    { label: 'Aprovados', value: 'approved' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie o acesso dos administradores.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filterOptions.map((option) => (
          <Button
            key={option.value}
            variant={filter === option.value ? 'default' : 'outline'}
            onClick={() => {
              setFilter(option.value);
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={admins}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        emptyMessage={loading ? 'Carregando usuários...' : 'Nenhum usuário encontrado.'}
      />
    </div>
  );
}
