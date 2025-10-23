import bcrypt from 'bcryptjs';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { connectMongo } from '@/lib/mongodb';
import AdminModel from '@/lib/models/Admin';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const { handlers: authHandlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 30
  },
  pages: {
    signIn: '/auth/login'
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;
        await connectMongo();
        const admin = await AdminModel.findOne({ email }).select('+password');
        if (!admin) {
          return null;
        }

        const isValid = await bcrypt.compare(password, admin.password);
        if (!isValid) {
          return null;
        }

        return {
          id: admin._id.toString(),
          name: admin.name,
          email: admin.email,
          role: admin.role
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as Record<string, unknown>).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || '';
        session.user.role = (token.role as string) || 'admin';
      }
      return session;
    }
  }
});
