'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { X, UploadCloud } from 'lucide-react';

export interface UploadedImage {
  _id: string;
  url: string;
  name?: string;
}

interface ImageUploadProps {
  value?: UploadedImage[];
  onChange?: (value: UploadedImage[]) => void;
  multiple?: boolean;
  folder?: string;
}

export function ImageUpload({ value = [], onChange, multiple, folder }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setError(null);

    const uploaded: UploadedImage[] = [];
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      if (folder) {
        formData.append('folder', folder);
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError((data as { error?: string }).error || 'Falha no upload');
        continue;
      }

      const data = (await response.json()) as UploadedImage;
      uploaded.push(data);
    }

    if (uploaded.length > 0) {
      if (multiple) {
        onChange?.([...value, ...uploaded]);
      } else {
        onChange?.([uploaded[0]]);
      }
    }

    setIsUploading(false);
  };

  const handleRemove = (id: string) => {
    onChange?.(value.filter((item) => item._id !== id));
  };

  return (
    <div className="space-y-4">
      <label
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/40 p-6 text-center transition hover:border-primary',
          isUploading && 'opacity-60'
        )}
      >
        <UploadCloud className="mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Arraste e solte ou clique para enviar</p>
        <Input type="file" className="hidden" multiple={multiple} onChange={(event) => handleFiles(event.target.files)} disabled={isUploading} accept="image/png,image/jpeg,image/webp" />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {value.map((item) => (
          <div key={item._id} className="relative overflow-hidden rounded-md border">
            <Image src={item.url} alt={item.name || 'Imagem'} width={300} height={200} className="h-32 w-full object-cover" />
            <Button
              variant="destructive"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8"
              onClick={() => handleRemove(item._id)}
              type="button"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
