'use client';

import * as React from 'react';

export interface ColumnOption {
  key: string;
  label: string;
  description?: string;
  defaultVisible?: boolean;
  alwaysVisible?: boolean;
}

interface ColumnPreferencesState {
  order: string[];
  visible: string[];
}

function buildDefaultState(options: ColumnOption[]): ColumnPreferencesState {
  const order = options.map((option) => option.key);
  const visible = options
    .filter((option) => option.alwaysVisible || option.defaultVisible !== false)
    .map((option) => option.key);

  return { order, visible };
}

function sanitizeState(options: ColumnOption[], state: ColumnPreferencesState): ColumnPreferencesState {
  const availableKeys = new Set(options.map((option) => option.key));

  const order = state.order.filter((key) => availableKeys.has(key));
  for (const option of options) {
    if (!order.includes(option.key)) {
      order.push(option.key);
    }
  }

  const visible = state.visible.filter((key) => availableKeys.has(key));
  for (const option of options) {
    if ((option.alwaysVisible || option.defaultVisible !== false) && !visible.includes(option.key)) {
      visible.push(option.key);
    }
  }

  return { order, visible };
}

export interface ColumnPreferencesControls {
  options: ColumnOption[];
  order: string[];
  visibleKeys: string[];
  toggleColumn: (key: string) => void;
  moveColumn: (key: string, direction: 'up' | 'down') => void;
  reset: () => void;
}

export function useColumnPreferences(storageKey: string, options: ColumnOption[]): ColumnPreferencesControls {
  const defaultState = React.useMemo(() => buildDefaultState(options), [options]);
  const [state, setState] = React.useState<ColumnPreferencesState>(defaultState);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedValue = window.localStorage.getItem(storageKey);
      if (!storedValue) {
        setState(defaultState);
        return;
      }

      const parsed = JSON.parse(storedValue) as ColumnPreferencesState | null;
      if (!parsed) {
        setState(defaultState);
        return;
      }

      setState(sanitizeState(options, parsed));
    } catch (error) {
      console.warn('Failed to read column preferences', error);
      setState(defaultState);
    }
    // we want to re-run when the available options change
  }, [storageKey, defaultState, options]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to persist column preferences', error);
    }
  }, [storageKey, state]);

  const toggleColumn = React.useCallback(
    (key: string) => {
      const option = options.find((item) => item.key === key);
      if (!option || option.alwaysVisible) return;

      setState((current) => {
        const isVisible = current.visible.includes(key);
        const nextVisible = isVisible
          ? current.visible.filter((value) => value !== key)
          : [...current.visible, key];

        return { ...current, visible: nextVisible };
      });
    },
    [options]
  );

  const moveColumn = React.useCallback((key: string, direction: 'up' | 'down') => {
    setState((current) => {
      const index = current.order.indexOf(key);
      if (index === -1) return current;

      const delta = direction === 'up' ? -1 : 1;
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= current.order.length) return current;

      const nextOrder = [...current.order];
      const [removed] = nextOrder.splice(index, 1);
      nextOrder.splice(nextIndex, 0, removed);

      return { ...current, order: nextOrder };
    });
  }, []);

  const reset = React.useCallback(() => {
    setState(buildDefaultState(options));
  }, [options]);

  const visibleKeys = React.useMemo(() => {
    const keys = new Set(state.visible);
    for (const option of options) {
      if (option.alwaysVisible) {
        keys.add(option.key);
      }
    }
    return Array.from(keys);
  }, [options, state.visible]);

  return {
    options,
    order: state.order,
    visibleKeys,
    toggleColumn,
    moveColumn,
    reset
  };
}
