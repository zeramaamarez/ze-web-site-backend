'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { forgotPasswordSchema, resetPasswordSchema } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const requestSchema = forgotPasswordSchema;
const resetSchema = resetPasswordSchema.pick({ password: true, confirmPassword: true });

type RequestValues = z.infer<typeof requestSchema>;
type ResetValues = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(false);

  const requestForm = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: '' }
  });

  const resetForm = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' }
  });

  const handleRequest = async (values: RequestValues) => {
    setLoading(true);
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });
    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao enviar email');
      return;
    }

    toast.success('Se o email existir, enviaremos instruções.');
  };

  const handleReset = async (values: ResetValues) => {
    if (!token) return;
    setLoading(true);
    const response = await fetch('/api/auth/forgot-password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, token })
    });
    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao redefinir senha');
      return;
    }

    toast.success('Senha atualizada com sucesso');
    router.push('/auth/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-6 dark:from-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-lg">
        {!token ? (
          <>
            <h1 className="mb-6 text-2xl font-semibold">Recuperar senha</h1>
            <form className="space-y-4" onSubmit={requestForm.handleSubmit(handleRequest)}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...requestForm.register('email')} />
                {requestForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{requestForm.formState.errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar link'}
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mb-6 text-2xl font-semibold">Redefinir senha</h1>
            <form className="space-y-4" onSubmit={resetForm.handleSubmit(handleReset)}>
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input id="password" type="password" {...resetForm.register('password')} />
                {resetForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{resetForm.formState.errors.password.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input id="confirmPassword" type="password" {...resetForm.register('confirmPassword')} />
                {resetForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">{resetForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enviando...' : 'Atualizar senha'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
