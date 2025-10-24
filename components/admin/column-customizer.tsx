'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, Check, GripVertical, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

import { type ColumnOption, type ColumnPreferencesControls } from './hooks/use-column-preferences';

interface ColumnCustomizerProps {
  preferences: ColumnPreferencesControls;
}

export function ColumnCustomizer({ preferences }: ColumnCustomizerProps) {
  const { options, order, visibleKeys, toggleColumn, moveColumn, reset } = preferences;

  const orderedOptions = React.useMemo(() => {
    const map = new Map(options.map((option) => [option.key, option]));
    return order
      .map((key) => map.get(key))
      .filter((option): option is ColumnOption => Boolean(option));
  }, [order, options]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 border-dashed">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Configurar visualização</span>
          <span className="sm:hidden">Colunas</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px] space-y-3">
        <div className="flex items-center justify-between gap-2 px-2">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold">Displayed fields</p>
            <p className="text-xs text-muted-foreground">Escolha as colunas que deseja visualizar.</p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={reset}>
            Reset
          </Button>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {orderedOptions.map((option, index) => {
            const isVisible = visibleKeys.includes(option.key);
            const isDisabled = option.alwaysVisible;
            return (
              <div
                key={option.key}
                className="flex items-center gap-2 rounded-md border border-transparent px-2 py-2 transition hover:border-border hover:bg-muted/60"
              >
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => moveColumn(option.key, 'up')}
                    disabled={index === 0}
                    aria-label={`Mover ${option.label} para cima`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => moveColumn(option.key, 'down')}
                    disabled={index === orderedOptions.length - 1}
                    aria-label={`Mover ${option.label} para baixo`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => toggleColumn(option.key)}
                  disabled={isDisabled}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <span
                    className={
                      'relative flex h-5 w-5 items-center justify-center rounded-md border border-input bg-background transition ' +
                      (isVisible ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground') +
                      (isDisabled ? ' opacity-80' : ' hover:border-primary/80')
                    }
                  >
                    {isVisible ? <Check className="h-3.5 w-3.5" /> : <GripVertical className="h-3.5 w-3.5 opacity-40" />}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {option.label}
                    {option.alwaysVisible && <span className="ml-2 text-xs text-muted-foreground">(fixo)</span>}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
