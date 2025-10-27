import { betterAuth } from 'better-auth';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import * as schema from './drizzle-schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

console.log('[Better Auth] Initializing with Drizzle adapter (node-postgres)');

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    defaultCookieAttributes: {
      sameSite: 'lax',
    },
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'],
  // Temporarily disabled to test if this causes the initialization error
  // user: {
  //   additionalFields: {
  //     username: {
  //       type: 'string',
  //       required: false,
  //       unique: true,
  //       input: true,
  //     },
  //     karma: {
  //       type: 'number',
  //       required: false,
  //       defaultValue: 50,
  //       input: false,
  //     },
  //     stats: {
  //       type: 'string',
  //       required: false,
  //       defaultValue: JSON.stringify({
  //         total_sessions: 0,
  //         songs_added: 0,
  //         avg_rating: 0,
  //       }),
  //       input: false,
  //     },
  //   },
  // },
});
