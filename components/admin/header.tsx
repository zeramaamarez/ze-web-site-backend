'use client';

import { useTransition } from 'react';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  name?: string | null;
  email?: string | null;
}

export function Header({ name, email }: HeaderProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div>
        <p className="text-sm text-muted-foreground">Autenticado como</p>
        <p className="text-sm font-medium">{name || email}</p>
      </div>
      <Button
        variant="outline"
        onClick={() =>
          startTransition(async () => {
            await signOut({ callbackUrl: '/' });
          })
        }
        disabled={isPending}
      >
        Sair
      </Button>
    </header>
  );
}
