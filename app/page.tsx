import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-slate-100 to-slate-200 p-8 dark:from-slate-900 dark:to-slate-950">
      <div className="max-w-2xl space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Painel administrativo Zé Ramalho</h1>
        <p className="text-muted-foreground">
          Acesse o painel administrativo para gerenciar livros, CDs, DVDs e clips.
        </p>
      </div>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/auth/login">Entrar</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/auth/register">Criar conta</Link>
        </Button>
      </div>
    </main>
  );
}
