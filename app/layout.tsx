import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from 'sonner';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Zé Ramalho CMS',
  description: 'Administração do conteúdo do site Zé Ramalho'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased text-base text-foreground',
          inter.variable
        )}
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
