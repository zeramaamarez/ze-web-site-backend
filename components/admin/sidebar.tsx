'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  BookOpenText,
  Calendar,
  Camera,
  ChevronsLeft,
  ChevronsRight,
  Clapperboard,
  Disc3,
  FileText,
  Images,
  LayoutDashboard,
  MessageSquare,
  Music,
  Users
} from 'lucide-react';

type SidebarRole = 'admin' | 'super_admin';

interface NavigationLink {
  href: string;
  label: string;
  icon: React.ElementType;
  gradient: string;
}

interface NavigationSection {
  title: string;
  links: NavigationLink[];
}

interface SidebarProps {
  role?: SidebarRole;
  name?: string | null;
  email?: string | null;
}

const baseSections: NavigationSection[] = [
  {
    title: 'Visão geral',
    links: [
      {
        href: '/admin',
        label: 'Dashboard',
        icon: LayoutDashboard,
        gradient: 'from-purple-500 via-indigo-500 to-sky-500'
      }
    ]
  },
  {
    title: 'Conteúdo',
    links: [
      { href: '/admin/books', label: 'Livros', icon: BookOpenText, gradient: 'from-indigo-500 to-purple-500' },
      { href: '/admin/cds', label: 'CDs', icon: Disc3, gradient: 'from-purple-500 to-pink-500' },
      { href: '/admin/dvds', label: 'DVDs', icon: Clapperboard, gradient: 'from-amber-500 to-orange-500' },
      { href: '/admin/clips', label: 'Clipes', icon: Camera, gradient: 'from-emerald-500 to-teal-500' },
      { href: '/admin/lyrics', label: 'Letras', icon: Music, gradient: 'from-pink-500 to-rose-500' },
      { href: '/admin/messages', label: 'Mensagens', icon: MessageSquare, gradient: 'from-sky-500 to-cyan-500' },
      { href: '/admin/shows', label: 'Shows', icon: Calendar, gradient: 'from-fuchsia-500 to-purple-500' },
      { href: '/admin/texts', label: 'Textos', icon: FileText, gradient: 'from-violet-500 to-indigo-500' }
    ]
  },
  {
    title: 'Mídia',
    links: [
      { href: '/admin/media', label: 'Biblioteca', icon: Images, gradient: 'from-sky-500 via-purple-500 to-pink-500' }
    ]
  }
];

const superAdminSection: NavigationSection = {
  title: 'Configurações',
  links: [{ href: '/admin/users', label: 'Usuários', icon: Users, gradient: 'from-slate-600 to-slate-900' }]
};

export function Sidebar({ role = 'admin', name, email }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const sections = useMemo(() => {
    if (role === 'super_admin') {
      return [...baseSections, superAdminSection];
    }
    return baseSections;
  }, [role]);

  const initials = useMemo(() => {
    if (name) {
      return name
        .split(' ')
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('');
    }
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    return 'ZR';
  }, [name, email]);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 92 : 288 }}
      className={cn(
        'relative z-30 flex h-screen flex-col border-r border-white/50 bg-white/80 shadow-2xl backdrop-blur-3xl transition-all duration-500',
        collapsed ? 'items-center' : 'items-stretch'
      )}
    >
      <div className="relative flex items-center justify-between px-5 py-6">
        <Link href="/admin" className="group flex items-center gap-3">
          <span
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 via-indigo-500 to-pink-500 text-xl font-bold text-white shadow-lg transition-transform duration-300 group-hover:scale-110',
              collapsed && 'h-10 w-10 text-lg'
            )}
          >
            ZR
          </span>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                key="brand"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-gradient-to-r from-slate-900 via-indigo-600 to-purple-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent"
              >
                Zé Ramalho CMS
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((previous) => !previous)}
          className="rounded-full border border-white/60 bg-white/70 p-2 text-slate-500 shadow-md transition hover:border-purple-200 hover:text-purple-600"
          aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="user-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="mx-5 mb-6 rounded-3xl border border-white/70 bg-gradient-to-br from-white/80 via-purple-50/60 to-indigo-50/80 p-4 shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 text-lg font-bold text-white shadow-lg">
                {initials}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{name || 'Administrador'}</p>
                <p className="text-xs text-slate-500">{email}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <nav
        className={cn('flex-1 space-y-6 overflow-y-auto px-3 pb-10', collapsed && 'w-full px-2')}
        aria-label="Menu principal"
      >
        {sections.map((section) => (
          <div key={section.title} className="space-y-3">
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.p
                  key={`${section.title}-title`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 0.7, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="px-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400"
                >
                  {section.title}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-2">
              {section.links.map((link) => {
                const Icon = link.icon;
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

                return (
                  <Link key={link.href} href={link.href} className="block">
                    <motion.span
                      whileHover={{ y: -2, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        'group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/60 bg-white/70 px-3 py-3 text-sm font-medium text-slate-600 shadow-sm backdrop-blur transition-all duration-300 hover:border-purple-200 hover:shadow-xl',
                        active &&
                          'border-transparent bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 text-white shadow-2xl'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg transition duration-300 group-hover:scale-110 group-hover:brightness-110',
                          active
                            ? 'from-white/30 via-white/20 to-white/10'
                            : link.gradient,
                          collapsed && 'h-11 w-11'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <AnimatePresence initial={false}>
                        {!collapsed && (
                          <motion.span
                            key={`${link.href}-label`}
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -12 }}
                            className={cn('flex-1 text-base', active ? 'font-semibold text-white' : 'text-slate-600')}
                          >
                            {link.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-5 pb-6">
        <div className="rounded-3xl border border-white/70 bg-gradient-to-br from-purple-500/10 via-white to-white/80 p-4 text-xs text-slate-500 shadow-inner">
          <p className="font-semibold text-slate-700">Precisa de ajuda?</p>
          <p className="mt-1 leading-relaxed">
            Acesse a central de suporte para tutoriais e dicas rápidas sobre como gerenciar o conteúdo.
          </p>
          <Link
            href="https://ze-ramalho.com.br/suporte"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:brightness-110"
          >
            Abrir suporte
          </Link>
        </div>
      </div>
    </motion.aside>
  );
}
