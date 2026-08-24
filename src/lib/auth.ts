import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { headers } from 'next/headers';
import { checkRateLimit } from '@/lib/rate-limit';
import { timingSafeEqualStr } from '@/lib/auth-jwt';

const LoginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        const validatedFields = LoginSchema.safeParse(credentials);

        if (!validatedFields.success) {
          return null;
        }

        const { username, password } = validatedFields.data;

        // Rate limit brute-force per IP (10 percobaan / 5 menit).
        try {
          const h = await headers();
          const ip = (h.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
          const rate = await checkRateLimit(`admin-login:${ip}`, 10, 5 * 60_000);
          if (!rate.ok) return null;
        } catch {
          // headers() tak tersedia di beberapa konteks — jangan blok login karena itu.
        }

        // Hardcoded credentials dari env (timing-safe compare).
        const userOk =
          Boolean(process.env.ADMIN_USERNAME) &&
          timingSafeEqualStr(username, process.env.ADMIN_USERNAME as string);
        const passOk =
          Boolean(process.env.ADMIN_PASSWORD) &&
          timingSafeEqualStr(password, process.env.ADMIN_PASSWORD as string);

        if (userOk && passOk) {
          return {
            id: '1',
            name: 'Admin Rumah Kripik',
            email: 'admin@rumahkripik.local',
          };
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 hari
  },
});
