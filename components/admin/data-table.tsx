'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: keyof T | string;
  header: React.ReactNode;
  className?: string;
  render?: (item: T) => React.ReactNode;
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
}

export function DataTable<T>({ columns, data, page, totalPages, onPageChange, search, onSearchChange, emptyMessage }: DataTableProps<T>) {
  return (
    <div className="space-y-4">
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
                <th key={String(column.key)} className={cn('px-4 py-2 text-left text-sm font-medium text-muted-foreground', column.className)}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage || 'Nenhum registro encontrado.'}
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr key={index} className="border-b last:border-b-0">
                  {columns.map((column) => (
                    <td key={String(column.key)} className={cn('px-4 py-3 text-sm', column.className)}>
                      {column.render ? column.render(item) : ((item as Record<string, unknown>)[column.key as string] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Página {page} de {totalPages || 1}
        </p>
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
