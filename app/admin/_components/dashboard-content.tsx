'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  BookOpenText,
  Camera,
  Calendar,
  Clapperboard,
  Disc3,
  FileText,
  Images,
  MessageSquare,
  Music,
  Sparkles,
  Waves,
  Cloud,
  HardDrive
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, Tooltip, XAxis } from 'recharts';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ContentStat {
  total: number;
  published: number;
}

interface TracksStat {
  cds: number;
  dvds: number;
  total: number;
}

interface CloudMetric {
  usage: number;
  limit?: number | null;
  usedPercent?: number | null;
}

interface CloudinaryStats {
  storage: CloudMetric;
  bandwidth: CloudMetric;
  resources: CloudMetric;
  lastUpdated?: string;
}

interface LatestItem {
  title: string;
  updatedAt: string | null;
  type: string;
}

export interface DashboardContentProps {
  stats: {
    books: ContentStat;
    cds: ContentStat;
    dvds: ContentStat;
    clips: ContentStat;
    lyrics: ContentStat;
    messages: ContentStat;
    photos: ContentStat;
    shows: ContentStat;
    texts: ContentStat;
    tracks: TracksStat;
    cloudinary: CloudinaryStats | null;
    latest: LatestItem[];
  };
}

const typeLabels: Record<string, string> = {
  books: 'Livro',
  cds: 'CD',
  dvds: 'DVD',
  clips: 'Clipe',
  lyrics: 'Letra',
  messages: 'Mensagem',
  photos: 'Foto',
  shows: 'Show',
  texts: 'Texto'
};

const timelineIconGradient: Record<string, string> = {
  books: 'from-purple-500 to-indigo-500',
  cds: 'from-indigo-500 to-sky-500',
  dvds: 'from-amber-500 to-orange-500',
  clips: 'from-emerald-500 to-teal-500',
  lyrics: 'from-rose-500 to-pink-500',
  messages: 'from-sky-500 to-cyan-500',
  photos: 'from-fuchsia-500 to-purple-500',
  shows: 'from-blue-500 to-indigo-500',
  texts: 'from-violet-500 to-indigo-500'
};

const chartGradient = (
  <defs>
    <linearGradient id="cardGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
      <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.35} />
      <stop offset="100%" stopColor="#ec4899" stopOpacity={0.3} />
    </linearGradient>
  </defs>
);

export function DashboardContent({ stats }: DashboardContentProps) {
  const navCards = useMemo(
    () => [
      {
        key: 'books',
        title: 'Livros',
        href: '/admin/books',
        icon: BookOpenText,
        stats: stats.books,
        accent: 'from-indigo-500 to-purple-500'
      },
      {
        key: 'cds',
        title: 'CDs',
        href: '/admin/cds',
        icon: Disc3,
        stats: stats.cds,
        accent: 'from-purple-500 to-pink-500'
      },
      {
        key: 'dvds',
        title: 'DVDs',
        href: '/admin/dvds',
        icon: Clapperboard,
        stats: stats.dvds,
        accent: 'from-amber-500 to-orange-500'
      },
      {
        key: 'clips',
        title: 'Clipes',
        href: '/admin/clips',
        icon: Camera,
        stats: stats.clips,
        accent: 'from-emerald-500 to-teal-500'
      },
      {
        key: 'lyrics',
        title: 'Letras',
        href: '/admin/lyrics',
        icon: Music,
        stats: stats.lyrics,
        accent: 'from-rose-500 to-pink-500'
      },
      {
        key: 'messages',
        title: 'Mensagens',
        href: '/admin/messages',
        icon: MessageSquare,
        stats: stats.messages,
        accent: 'from-sky-500 to-cyan-500'
      },
      {
        key: 'photos',
        title: 'Fotos',
        href: '/admin/photos',
        icon: Images,
        stats: stats.photos,
        accent: 'from-fuchsia-500 to-purple-500'
      },
      {
        key: 'shows',
        title: 'Shows',
        href: '/admin/shows',
        icon: Calendar,
        stats: stats.shows,
        accent: 'from-blue-500 to-indigo-500'
      },
      {
        key: 'texts',
        title: 'Textos',
        href: '/admin/texts',
        icon: FileText,
        stats: stats.texts,
        accent: 'from-violet-500 to-indigo-500'
      }
    ],
    [stats]
  );

  const highlightDataset = useMemo(
    () =>
      navCards.map((card) => ({
        name: card.title,
        publicados: card.stats.published,
        rascunhos: Math.max(0, card.stats.total - card.stats.published)
      })),
    [navCards]
  );

  const trackDataset = useMemo(
    () => [
      { name: 'CDs', value: stats.tracks.cds },
      { name: 'DVDs', value: stats.tracks.dvds },
      { name: 'Total', value: stats.tracks.total }
    ],
    [stats.tracks]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="space-y-10"
    >
      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {navCards.map((card, index) => {
          const Icon = card.icon;
          const completion = card.stats.total > 0 ? (card.stats.published / card.stats.total) * 100 : 0;
          const totalFormatted = new Intl.NumberFormat('pt-BR').format(card.stats.total);
          const publishedFormatted = new Intl.NumberFormat('pt-BR').format(card.stats.published);

          const chartData = [
            { etapa: 'Publicados', valor: card.stats.published },
            { etapa: 'Rascunhos', valor: Math.max(0, card.stats.total - card.stats.published) }
          ];

          return (
            <Link key={card.key} href={card.href} className="group">
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur-xl transition"
              >
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/40 via-white/20 to-white/0 opacity-0 transition duration-500 group-hover:opacity-100" />
                <div className="relative flex h-full flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br text-white shadow-2xl ring-4 ring-white/60 transition duration-300 group-hover:brightness-110',
                        card.accent
                      )}
                    >
                      <Icon className="h-9 w-9" />
                    </span>
                    <Badge className="rounded-full border border-white/50 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-pink-500/10 px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                      <span className="flex items-center gap-1">
                        {publishedFormatted} publicados
                      </span>
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">{card.title}</p>
                    <h2 className="text-5xl font-bold tracking-tight text-slate-900">{totalFormatted}</h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {publishedFormatted} conteúdos ao vivo de {totalFormatted} cadastrados
                    </p>
                  </div>
                  <Progress value={completion} className="h-2" />
                  <div className="relative h-20 w-full overflow-hidden rounded-2xl border border-white/60 bg-white/60">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, bottom: 0, left: 0, right: 0 }}>
                        {chartGradient}
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="etapa" hide tickLine={false} axisLine={false} padding={{ left: 10, right: 10 }} />
                        <Tooltip
                          cursor={{ fill: 'transparent' }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const entry = payload[0];
                            return (
                              <div className="rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-xs font-medium text-slate-600 shadow-lg">
                                {entry.name}: {new Intl.NumberFormat('pt-BR').format(entry.value as number)}
                              </div>
                            );
                          }}
                        />
                        <Area type="monotone" dataKey="valor" stroke="#6366f1" fill="url(#cardGradient)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-between text-sm font-semibold text-purple-600">
                    <span className="flex items-center gap-2">
                      Explorar seção
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-medium text-slate-400">Hover para pré-visualizar</span>
                  </div>
                </div>
              </motion.div>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.8fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="space-y-6"
        >
          <Card className="overflow-hidden rounded-3xl border-white/70 bg-white/80 shadow-xl">
            <div className="flex flex-col gap-6 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">Performance editorial</h3>
                  <p className="text-sm text-slate-500">Publicações vs rascunhos por tipo de conteúdo</p>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 via-indigo-500 to-pink-500 text-white shadow-2xl">
                  <Waves className="h-6 w-6" />
                </span>
              </div>
              <div className="h-64 overflow-hidden rounded-3xl border border-white/70 bg-white/60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={highlightDataset} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
                    {chartGradient}
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip
                      cursor={{ strokeDasharray: '4 4', stroke: '#c7d2fe' }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const [publicados, rascunhos] = payload;
                        return (
                          <div className="space-y-1 rounded-2xl border border-white/80 bg-white/95 px-4 py-3 text-xs text-slate-600 shadow-xl">
                            <p className="font-semibold text-slate-700">{label}</p>
                            <p>Publicados: {new Intl.NumberFormat('pt-BR').format(publicados?.value as number)}</p>
                            <p>Rascunhos: {new Intl.NumberFormat('pt-BR').format(rascunhos?.value as number)}</p>
                          </div>
                        );
                      }}
                    />
                    <Area type="monotone" dataKey="publicados" stroke="#6366f1" fill="url(#cardGradient)" strokeWidth={2} />
                    <Area type="monotone" dataKey="rascunhos" stroke="#f97316" fill="rgba(249,115,22,0.2)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden rounded-3xl border-white/70 bg-white/80 shadow-xl">
            <div className="flex flex-col gap-6 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">Estatísticas de faixas</h3>
                  <p className="text-sm text-slate-500">Total e distribuição entre CDs e DVDs</p>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-2xl">
                  <Sparkles className="h-6 w-6" />
                </span>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="rounded-2xl border border-white/60 bg-emerald-500/10 px-3 py-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">CDs</p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-600">{stats.tracks.cds}</p>
                  </div>
                  <div className="rounded-2xl border border-white/60 bg-sky-500/10 px-3 py-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-sky-600">DVDs</p>
                    <p className="mt-1 text-2xl font-semibold text-sky-600">{stats.tracks.dvds}</p>
                  </div>
                  <div className="rounded-2xl border border-white/60 bg-purple-500/10 px-3 py-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-purple-600">Total</p>
                    <p className="mt-1 text-2xl font-semibold text-purple-600">{stats.tracks.total}</p>
                  </div>
                </div>
                <div className="h-40 overflow-hidden rounded-3xl border border-white/70 bg-white/60">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trackDataset} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
                      {chartGradient}
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <Tooltip
                        cursor={{ strokeDasharray: '4 4', stroke: '#34d399' }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const entry = payload[0];
                          return (
                            <div className="rounded-2xl border border-white/80 bg-white/95 px-4 py-2 text-xs font-medium text-slate-600 shadow-xl">
                              {label}: {new Intl.NumberFormat('pt-BR').format(entry.value as number)} faixas
                            </div>
                          );
                        }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#10b981" fill="rgba(16,185,129,0.2)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
          className="space-y-6"
        >
          <Card className="overflow-hidden rounded-3xl border-white/70 bg-white/80 shadow-xl">
            <div className="flex flex-col gap-5 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Uso do Cloudinary</h3>
                  <p className="text-xs text-slate-500">Monitoramento em tempo real de armazenamento e banda</p>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-2xl">
                  <Cloud className="h-6 w-6" />
                </span>
              </div>
              {stats.cloudinary ? (
                <div className="space-y-5 text-sm text-slate-600">
                  {[{ key: 'storage', label: 'Armazenamento' }, { key: 'bandwidth', label: 'Banda' }, { key: 'resources', label: 'Recursos' }].map((metric) => {
                    const metricValue = stats.cloudinary?.[metric.key as keyof CloudinaryStats] as CloudMetric | undefined;
                    const limit = metricValue?.limit ?? null;
                    const percent = metricValue?.usedPercent ?? (limit ? (metricValue.usage / limit) * 100 : 0);
                    const formattedUsage = metric.key === 'resources'
                      ? new Intl.NumberFormat('pt-BR').format(metricValue?.usage ?? 0)
                      : formatDataSize(metricValue?.usage ?? 0);
                    const formattedLimit = limit
                      ? metric.key === 'resources'
                        ? new Intl.NumberFormat('pt-BR').format(limit)
                        : formatDataSize(limit)
                      : null;

                    return (
                      <div key={metric.key} className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                          <span>{metric.label}</span>
                          <span>{percent ? percent.toFixed(1) : '0.0'}%</span>
                        </div>
                        <Progress value={percent ?? 0} />
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{formattedUsage}</span>
                          <span>{formattedLimit ? `Limite: ${formattedLimit}` : 'Limite não definido'}</span>
                        </div>
                      </div>
                    );
                  })}
                  {stats.cloudinary.lastUpdated && (
                    <p className="text-xs text-slate-400">Atualizado em {format(new Date(stats.cloudinary.lastUpdated), "dd MMM 'às' HH:mm", { locale: ptBR })}</p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50/40 p-6 text-center text-sm text-slate-500">
                  <p className="font-medium text-slate-600">Não foi possível carregar os dados do Cloudinary.</p>
                  <p className="mt-2 text-xs text-slate-400">Verifique a integração e tente novamente em alguns minutos.</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden rounded-3xl border-white/70 bg-white/80 shadow-xl">
            <div className="flex flex-col gap-5 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Biblioteca de mídia</h3>
                  <p className="text-xs text-slate-500">Gerencie fotos, vídeos e arquivos em segundos</p>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 text-white shadow-2xl">
                  <HardDrive className="h-6 w-6" />
                </span>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  Acesse a nova biblioteca em mosaico com pré-visualização instantânea, lightbox elegante e estados de carregamento animados.
                </p>
                <Link
                  href="/admin/media"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:brightness-110"
                >
                  Ir para a biblioteca
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </Card>
        </motion.div>
      </section>

      <section>
        <Card className="overflow-hidden rounded-3xl border-white/70 bg-white/80 shadow-xl">
          <div className="grid gap-6 p-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-slate-900">Últimas atualizações</h3>
                <p className="text-sm text-slate-500">Linha do tempo dos conteúdos recém-modificados</p>
              </div>
              <Badge className="rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 px-4 py-2 text-xs font-semibold text-white shadow-lg">
                Atualizações em tempo real
              </Badge>
            </div>
            <ul className="relative space-y-4 border-l border-dashed border-purple-200 pl-6">
              {stats.latest.map((item, index) => {
                const label = typeLabels[item.type] ?? 'Conteúdo';
                const gradient = timelineIconGradient[item.type] ?? 'from-slate-500 to-slate-700';
                const parsedDate = item.updatedAt ? new Date(item.updatedAt) : null;
                const formattedDate = parsedDate
                  ? format(parsedDate, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })
                  : 'Data não disponível';

                return (
                  <motion.li
                    key={`${item.type}-${item.title}-${index}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="group relative"
                  >
                    <span
                      className={cn(
                        'absolute -left-[29px] top-2 h-5 w-5 rounded-full border-2 border-white shadow-lg transition group-hover:scale-110',
                        `bg-gradient-to-br ${gradient}`
                      )}
                    />
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/70 bg-white/70 px-5 py-4 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{item.title}</p>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
                      </div>
                      <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-600">
                        {formattedDate}
                      </span>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </Card>
      </section>
    </motion.div>
  );
}

function formatDataSize(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  const gigabytes = megabytes / 1024;

  if (gigabytes >= 1) {
    return `${gigabytes.toFixed(2)} GB`;
  }

  if (megabytes >= 1) {
    return `${megabytes.toFixed(2)} MB`;
  }

  return `${(bytes / 1024).toFixed(2)} KB`;
}
