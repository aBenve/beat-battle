'use client';

// Better Auth doesn't use a traditional Provider like NextAuth
// It uses nano-store for reactive state management
// This is just a passthrough component for consistency
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
