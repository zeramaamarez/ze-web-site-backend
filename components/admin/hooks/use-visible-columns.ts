'use client';

import * as React from 'react';

import type { Column } from '@/components/admin/data-table';

import type { ColumnPreferencesControls } from './use-column-preferences';

export type EnhancedColumn<T> = Column<T> & {
  key: string;
  label: string;
  defaultVisible?: boolean;
  alwaysVisible?: boolean;
};

export function useVisibleColumns<T>(
  allColumns: EnhancedColumn<T>[],
  preferences: ColumnPreferencesControls
): Column<T>[] {
  return React.useMemo(() => {
    const visibility = new Set(preferences.visibleKeys);
    const map = new Map(allColumns.map((column) => [String(column.key), column]));

    return preferences.order
      .map((key) => map.get(key))
      .filter((column): column is EnhancedColumn<T> => Boolean(column))
      .filter((column) => column.alwaysVisible || visibility.has(String(column.key)));
  }, [allColumns, preferences.order, preferences.visibleKeys]);
}
