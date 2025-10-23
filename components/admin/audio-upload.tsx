'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Music, X, UploadCloud } from 'lucide-react';

export interface UploadedAudio {
  _id: string;
  url: string;
  name?: string;
}

interface AudioUploadProps {
  value?: UploadedAudio;
  onChange?: (value: UploadedAudio | null) => void;
  folder?: string;
}

export function AudioUpload({ value, onChange, folder }: AudioUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    if (folder) formData.append('folder', folder);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    setIsUploading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError((data as { error?: string }).error || 'Falha no upload');
      return;
    }

    const data = (await response.json()) as UploadedAudio;
    onChange?.(data);
  };

  const handleRemove = () => {
    onChange?.(null);
  };

  return (
    <div className="space-y-4">
      {!value ? (
        <label
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/40 p-6 text-center transition hover:border-primary',
            isUploading && 'opacity-60'
          )}
        >
          <UploadCloud className="mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Clique para enviar áudio (MP3, WAV)</p>
          <Input
            type="file"
            className="hidden"
            onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])}
            disabled={isUploading}
            accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg"
          />
        </label>
      ) : (
        <div className="flex items-center gap-3 rounded-md border p-4">
          <Music className="h-6 w-6 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">{value.name || 'Áudio'}</p>
            <audio controls className="mt-2 w-full">
              <source src={value.url} type="audio/mpeg" />
            </audio>
          </div>
          <Button variant="destructive" size="icon" onClick={handleRemove} type="button">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
