'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { BookOpenText, Disc3, Film, Clapperboard, LayoutDashboard, Users } from 'lucide-react';

const baseLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/books', label: 'Livros', icon: BookOpenText },
  { href: '/admin/cds', label: 'CDs', icon: Disc3 },
  { href: '/admin/dvds', label: 'DVDs', icon: Film },
  { href: '/admin/clips', label: 'Clips', icon: Clapperboard }
];

const superAdminLinks = [{ href: '/admin/users', label: 'Usuários', icon: Users }];

interface SidebarProps {
  role?: 'admin' | 'super_admin';
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const links = role === 'super_admin' ? [...baseLinks, ...superAdminLinks] : baseLinks;

  return (
    <aside className="flex w-64 flex-col border-r bg-card">
      <div className="px-6 py-4 text-lg font-semibold">Zé Ramalho CMS</div>
      <nav className="flex-1 space-y-1 px-3 pb-6">
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                active && 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
