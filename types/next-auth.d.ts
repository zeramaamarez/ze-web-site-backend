import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      role?: 'admin' | 'super_admin';
    };
  }

  interface User {
    role?: 'admin' | 'super_admin';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: 'admin' | 'super_admin';
  }
}
