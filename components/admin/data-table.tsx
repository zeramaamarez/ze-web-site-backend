'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: keyof T | string;
  header: React.ReactNode;
  className?: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  page: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  emptyMessage?: string;
  isLoading?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  sortKey?: string | null;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (key: string, order: 'asc' | 'desc') => void;
  totalItems?: number;
  toolbar?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  page,
  totalPages,
  onPageChange,
  search,
  onSearchChange,
  emptyMessage,
  isLoading,
  pageSize,
  pageSizeOptions = [10, 20, 50],
  onPageSizeChange,
  sortKey,
  sortOrder = 'asc',
  onSortChange,
  totalItems,
  toolbar
}: DataTableProps<T>) {
  const handleSort = React.useCallback(
    (columnKey: string) => {
      if (!onSortChange) return;
      const nextOrder: 'asc' | 'desc' = sortKey === columnKey ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc';
      onSortChange(columnKey, nextOrder);
    },
    [onSortChange, sortKey, sortOrder]
  );

  const paginationSummary = React.useMemo(() => {
    if (typeof totalItems !== 'number' || typeof pageSize !== 'number' || totalItems === 0) {
      return `Página ${page} de ${totalPages || 1}`;
    }

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(totalItems, page * pageSize);
    return `Exibindo ${start}–${end} de ${totalItems}`;
  }, [page, pageSize, totalItems, totalPages]);

  return (
    <div className="space-y-4">
      {toolbar}
      {onSearchChange && (
        <Input
          placeholder="Buscar..."
          value={search ?? ''}
          onChange={(event) => onSearchChange(event.target.value)}
          className="max-w-sm"
        />
      )}
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    'px-4 py-2 text-left text-sm font-medium text-muted-foreground',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.className
                  )}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      className="flex items-center gap-1 text-left transition hover:text-foreground"
                      onClick={() => handleSort(String(column.key))}
                    >
                      <span>{column.header}</span>
                      {sortKey === column.key ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: Math.min(pageSize ?? 5, 5) }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b last:border-b-0">
                  {columns.map((column, columnIndex) => (
                    <td key={columnIndex} className={cn('px-4 py-3 text-sm', column.className)}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage || 'Nenhum registro encontrado.'}
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr key={index} className="border-b last:border-b-0">
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={cn(
                        'px-4 py-3 text-sm',
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right',
                        column.className
                      )}
                    >
                      {column.render ? column.render(item) : ((item as Record<string, unknown>)[column.key as string] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <p className="text-sm text-muted-foreground">{paginationSummary}</p>
          {onPageSizeChange && pageSizeOptions.length > 0 && (
            <Select value={String(pageSize ?? pageSizeOptions[0])} onValueChange={(value) => onPageSizeChange(Number(value))}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Itens por página" />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option} por página
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => onPageChange?.(Math.max(1, page - 1))} disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange?.(Math.min(totalPages || 1, page + 1))}
            disabled={page >= (totalPages || 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
