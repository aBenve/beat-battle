import { betterAuth } from 'better-auth';

// Minimal configuration for testing
export const auth = betterAuth({
  database: {
    provider: 'postgres',
    url: process.env.DATABASE_URL!,
  },
});
