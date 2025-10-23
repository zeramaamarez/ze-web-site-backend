'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { loginSchema } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const formSchema = loginSchema;

type FormValues = z.infer<typeof formSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/admin';
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    const response = await signIn('credentials', {
      redirect: false,
      email: values.email,
      password: values.password,
      callbackUrl
    });

    setLoading(false);

    if (response?.error) {
      toast.error('Credenciais inválidas');
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-6 dark:from-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-lg">
        <h1 className="mb-6 text-2xl font-semibold">Entrar</h1>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="email@exemplo.com" {...form.register('email')} />
            {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" {...form.register('password')} />
            {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
        <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
          <p>
            Ainda não possui conta?{' '}
            <Link href="/auth/register" className="text-primary underline">
              Cadastre-se
            </Link>
          </p>
          <p>
            Esqueceu sua senha?{' '}
            <Link href="/auth/forgot-password" className="text-primary underline">
              Recuperar acesso
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
