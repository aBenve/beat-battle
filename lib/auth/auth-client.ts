import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import type { auth } from './auth';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  plugins: [
    inferAdditionalFields<typeof auth>(), // Infer custom fields from server config
  ],
});

// Export hooks and methods for easy use
export const useSession = authClient.useSession;

// Note: signIn, signOut, signUp are called as methods on authClient
// Example: authClient.signIn.email({ email, password })
// Example: authClient.signIn.social({ provider: 'google' })
// Example: authClient.signOut()
// Example: authClient.signUp.email({ email, password, name, username })
