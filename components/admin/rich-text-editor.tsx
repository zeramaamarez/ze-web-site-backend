'use client';

import { Textarea } from '@/components/ui/textarea';

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  rows?: number;
}

export function RichTextEditor({ value, onChange, rows = 6 }: RichTextEditorProps) {
  return <Textarea value={value} onChange={(event) => onChange?.(event.target.value)} rows={rows} />;
}
