'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Copy,
  ImageIcon,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
  View
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

interface MediaAsset {
  _id: string;
  name: string;
  url: string;
  ext?: string;
  mime?: string;
  type?: string;
  size?: number;
  width?: number;
  height?: number;
  hash?: string;
  cloudinaryId?: string;
  provider?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  provider_metadata?: {
    public_id?: string;
    resource_type?: string;
  };
}

interface MediaLibraryResponse {
  data: MediaAsset[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    total: number;
  };
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

function formatFileSize(sizeValue?: number | null) {
  if (!sizeValue || sizeValue <= 0) {
    return '—';
  }

  const isProbablyBytes = sizeValue > 1024 * 1024;
  const sizeInBytes = isProbablyBytes ? sizeValue : sizeValue * 1024;
  const formatter = new Intl.NumberFormat('pt-BR', {
    style: 'unit',
    unit: 'byte',
    unitDisplay: 'short'
  });

  if (sizeInBytes >= 1024 * 1024 * 1024) {
    return `${(sizeInBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  if (sizeInBytes >= 1024 * 1024) {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  if (sizeInBytes >= 1024) {
    return `${(sizeInBytes / 1024).toFixed(2)} KB`;
  }

  return formatter.format(sizeInBytes);
}

function formatDimensions(asset: MediaAsset) {
  if (!asset.width || !asset.height) {
    return '—';
  }
  return `${asset.width} × ${asset.height}`;
}

function formatDate(date?: string | null) {
  if (!date) return '—';
  try {
    return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch (error) {
    console.error('Failed to format date', error);
    return '—';
  }
}

function isImage(asset: MediaAsset) {
  if (asset.mime?.startsWith('image/')) {
    return true;
  }

  return asset.type === 'image';
}

function getAssetTypeLabel(asset: MediaAsset) {
  if (asset.type) {
    return asset.type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter: string) => letter.toUpperCase());
  }

  if (asset.mime) {
    return asset.mime;
  }

  return '—';
}

export default function MediaLibraryPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'audio' | 'video' | 'raw' | 'other'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | '24h' | '7d' | '30d' | '90d' | '365d'>('all');
  const [sizeFilter, setSizeFilter] = useState<'all' | 'small' | 'medium' | 'large'>('all');
  const [sortField, setSortField] = useState<'createdAt' | 'name' | 'size'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<MediaAsset | null>(null);

  const cloudinaryPublicId =
    selectedAsset?.cloudinaryId || selectedAsset?.provider_metadata?.public_id || null;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);

    return () => clearTimeout(handler);
  }, [search]);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort: sortField,
        order: sortOrder
      });

      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }

      if (typeFilter !== 'all') {
        params.set('type', typeFilter);
      }

      if (dateFilter !== 'all') {
        params.set('dateRange', dateFilter);
      }

      if (sizeFilter !== 'all') {
        params.set('size', sizeFilter);
      }

      const response = await fetch(`/api/media?${params.toString()}`);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error || 'Erro ao carregar arquivos');
        return;
      }

      const data = (await response.json()) as MediaLibraryResponse;
      const nextAssets = Array.isArray(data.data) ? data.data : [];
      const nextTotalPages = Math.max(1, data.pagination.totalPages || 1);
      const nextPage = Math.min(data.pagination.page || 1, nextTotalPages);

      setAssets(nextAssets);
      setTotalPages(nextTotalPages);
      setPage(nextPage);
      setTotalItems(data.pagination.total || 0);
    } catch (error) {
      console.error('Failed to load media assets', error);
      toast.error('Erro ao carregar arquivos');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortField, sortOrder, debouncedSearch, typeFilter, dateFilter, sizeFilter]);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          toast.error(data?.error || `Falha ao enviar ${file.name}`);
          continue;
        }

        successCount += 1;
      }

      if (successCount > 0) {
        toast.success(
          successCount === 1 ? 'Arquivo enviado com sucesso' : `${successCount} arquivos enviados com sucesso`
        );
        if (page !== 1) {
          setPage(1);
        } else {
          await fetchAssets();
        }
      }
    } catch (error) {
      console.error('Failed to upload files', error);
      toast.error('Erro ao enviar arquivos');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCopyUrl = async (asset: MediaAsset) => {
    try {
      await navigator.clipboard.writeText(asset.url);
      toast.success('URL copiada para a área de transferência');
    } catch (error) {
      console.error('Failed to copy url', error);
      toast.error('Não foi possível copiar a URL');
    }
  };

  const confirmDelete = async () => {
    if (!assetToDelete) return;

    try {
      const response = await fetch(`/api/upload/${assetToDelete._id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error || 'Erro ao remover arquivo');
        return;
      }

      toast.success('Arquivo removido');
      if (assets.length <= 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      } else {
        await fetchAssets();
      }
    } catch (error) {
      console.error('Failed to delete asset', error);
      toast.error('Erro ao remover arquivo');
    } finally {
      setAssetToDelete(null);
    }
  };

  const paginationInfo = useMemo(() => {
    if (totalItems === 0) {
      return 'Nenhum arquivo encontrado';
    }

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(totalItems, page * pageSize);
    return `Exibindo ${start}–${end} de ${totalItems}`;
  }, [page, pageSize, totalItems]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Media Library</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie todos os arquivos enviados e organize sua biblioteca de mídia.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="outline" onClick={() => void fetchAssets()} disabled={loading} className="sm:w-auto">
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button onClick={handleUploadClick} disabled={isUploading} className="sm:w-auto">
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            {isUploading ? 'Enviando...' : 'Enviar arquivos'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept="image/*,video/*,audio/*"
            onChange={(event) => void handleUpload(event.target.files)}
          />
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-4">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nome do arquivo"
            className="w-full"
          />
          <Select
            value={typeFilter}
            onValueChange={(value: typeof typeFilter) => {
              setTypeFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo de arquivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="image">Imagens</SelectItem>
              <SelectItem value="video">Vídeos</SelectItem>
              <SelectItem value="audio">Áudio</SelectItem>
              <SelectItem value="raw">Documentos</SelectItem>
              <SelectItem value="other">Outros</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={dateFilter}
            onValueChange={(value: typeof dateFilter) => {
              setDateFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as datas</SelectItem>
              <SelectItem value="24h">Últimas 24 horas</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="365d">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sizeFilter}
            onValueChange={(value: typeof sizeFilter) => {
              setSizeFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tamanho" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tamanhos</SelectItem>
              <SelectItem value="small">Até 1MB</SelectItem>
              <SelectItem value="medium">1MB a 5MB</SelectItem>
              <SelectItem value="large">Mais de 5MB</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 md:grid-cols-2 md:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={sortField}
              onValueChange={(value: typeof sortField) => {
                setSortField(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Data de upload</SelectItem>
                <SelectItem value="name">Nome</SelectItem>
                <SelectItem value="size">Tamanho</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sortOrder}
              onValueChange={(value: typeof sortOrder) => {
                setSortOrder(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Ordem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Descendente</SelectItem>
                <SelectItem value="asc">Ascendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{paginationInfo}</p>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                const next = Number(value) as typeof PAGE_SIZE_OPTIONS[number];
                setPageSize(next);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Itens por página" />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option} por página
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div>
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: Math.min(pageSize, 12) }).map((_, index) => (
              <div key={index} className="space-y-3 rounded-lg border bg-card p-4">
                <Skeleton className="aspect-[4/3] w-full rounded-md" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/40 py-16 text-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-semibold">Nenhum item encontrado</p>
              <p className="text-sm text-muted-foreground">
                Ajuste os filtros ou envie novos arquivos para começar a construir sua biblioteca.
              </p>
            </div>
            <Button onClick={handleUploadClick} variant="outline">
              <UploadCloud className="mr-2 h-4 w-4" /> Enviar arquivos
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assets.map((asset) => (
              <div key={asset._id} className="group flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition hover:shadow-md">
                <button
                  type="button"
                  onClick={() => setSelectedAsset(asset)}
                  className="relative aspect-[4/3] w-full overflow-hidden bg-muted"
                >
                  {isImage(asset) ? (
                    <Image
                      src={asset.url}
                      alt={asset.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-10 w-10" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition group-hover:opacity-100">
                    <span className="inline-flex items-center gap-2 rounded-md bg-white/90 px-3 py-1 text-xs font-medium text-black">
                      <View className="h-3.5 w-3.5" /> Visualizar detalhes
                    </span>
                  </div>
                </button>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <p className="truncate font-medium" title={asset.name}>
                      {asset.name}
                    </p>
                    <p className="text-xs uppercase text-muted-foreground">
                      {asset.ext ? asset.ext.replace('.', '') : asset.mime || '—'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <p className="font-medium text-foreground">Dimensões</p>
                      <p>{formatDimensions(asset)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Tamanho</p>
                      <p>{formatFileSize(asset.size)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Upload</p>
                      <p>{formatDate(asset.createdAt)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Tipo</p>
                      <p>{getAssetTypeLabel(asset)}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => void handleCopyUrl(asset)}>
                      <Copy className="mr-2 h-4 w-4" /> Copiar URL
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => setAssetToDelete(asset)}
                      aria-label="Remover arquivo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{paginationInfo}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || loading}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages || loading}
          >
            Próxima
          </Button>
        </div>
      </div>

      <Dialog open={Boolean(selectedAsset)} onOpenChange={(open) => !open && setSelectedAsset(null)}>
        <DialogContent className="max-w-4xl">
          {selectedAsset && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedAsset.name}</DialogTitle>
                <DialogDescription>Detalhes do arquivo na biblioteca de mídia</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                <div className="overflow-hidden rounded-lg border bg-muted">
                  {isImage(selectedAsset) ? (
                    <div className="relative aspect-[4/3]">
                      <Image
                        src={selectedAsset.url}
                        alt={selectedAsset.name}
                        fill
                        sizes="(max-width: 1024px) 100vw, 66vw"
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
                      <ImageIcon className="h-12 w-12" />
                      <p className="text-sm">Pré-visualização indisponível para este tipo de arquivo.</p>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <dl className="space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-muted-foreground">Formato</dt>
                        <dd className="font-medium text-foreground">
                          {selectedAsset.ext ? selectedAsset.ext.replace('.', '').toUpperCase() : selectedAsset.mime || '—'}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-muted-foreground">Tipo</dt>
                        <dd className="font-medium text-foreground">{getAssetTypeLabel(selectedAsset)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-muted-foreground">Dimensões</dt>
                        <dd className="font-medium text-foreground">{formatDimensions(selectedAsset)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-muted-foreground">Tamanho</dt>
                        <dd className="font-medium text-foreground">{formatFileSize(selectedAsset.size)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-muted-foreground">Data de upload</dt>
                        <dd className="font-medium text-foreground">{formatDate(selectedAsset.createdAt)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-muted-foreground">Atualizado em</dt>
                        <dd className="font-medium text-foreground">{formatDate(selectedAsset.updatedAt)}</dd>
                      </div>
                      <div className="flex flex-col gap-1">
                        <dt className="text-muted-foreground">URL do arquivo</dt>
                        <dd className="truncate text-xs text-foreground" title={selectedAsset.url}>
                          {selectedAsset.url}
                        </dd>
                      </div>
                      {cloudinaryPublicId && (
                        <div className="flex flex-col gap-1">
                          <dt className="text-muted-foreground">Cloudinary public ID</dt>
                          <dd className="truncate text-xs text-foreground" title={cloudinaryPublicId}>
                            {cloudinaryPublicId}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button onClick={() => void handleCopyUrl(selectedAsset)}>
                      <Copy className="mr-2 h-4 w-4" /> Copiar URL
                    </Button>
                    <Button variant="destructive" onClick={() => setAssetToDelete(selectedAsset)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Remover arquivo
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(assetToDelete)} onOpenChange={(open) => !open && setAssetToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remover arquivo</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja remover permanentemente este arquivo? Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
