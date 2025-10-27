'use client';

import { Textarea } from '@/components/ui/textarea';

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  rows?: number;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, rows = 6, placeholder }: RichTextEditorProps) {
  return (
    <Textarea
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      rows={rows}
      placeholder={placeholder}
    />
  );
}
