import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@bizz/database';
import bcrypt from 'bcryptjs';
export const authOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Email and password required');
                }
                // Query user from Prisma
                const user = await prisma.user.findUnique({
                    where: { email: credentials.email.toLowerCase() }
                });
                if (!user || !user.passwordHash) {
                    throw new Error('Invalid email or password');
                }
                // Verify password
                const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
                if (!isValidPassword) {
                    throw new Error('Invalid email or password');
                }
                // Return user object
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    address: user.address
                };
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.address = user.address;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id;
                session.user.role = token.role;
                session.user.walletAddress = token.address;
            }
            return session;
        }
    },
    pages: {
        signIn: '/auth/signin',
        error: '/auth/error'
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60 // 30 days
    },
    secret: process.env.NEXTAUTH_SECRET
};
//# sourceMappingURL=auth.js.map