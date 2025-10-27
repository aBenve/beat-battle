'use client';

import { useState } from 'react';
import { useSession, authClient } from '@/lib/auth/auth-client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import SignInDialog from './sign-in-dialog';
import { LogOut, User, Trophy } from 'lucide-react';
import Link from 'next/link';

export default function UserMenu() {
  const { data: session, isPending } = useSession();
  const [showSignIn, setShowSignIn] = useState(false);

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/';
        },
      },
    });
  };

  if (isPending) {
    return (
      <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
    );
  }

  if (!session?.user) {
    return (
      <>
        <Button onClick={() => setShowSignIn(true)} variant="outline" size="sm">
          Sign In
        </Button>
        <SignInDialog open={showSignIn} onOpenChange={setShowSignIn} />
      </>
    );
  }

  const user = session.user;
  const initials = user.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || user.email?.[0]?.toUpperCase() || '?';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const karma = (user as any).karma;

  return (
    <div className="flex items-center gap-2">
      {/* Karma Badge */}
      {karma !== undefined && (
        <Link href="/profile">
          <Button variant="ghost" size="sm" className="gap-1">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span className="font-semibold">{karma}</span>
          </Button>
        </Link>
      )}

      {/* User Avatar */}
      <div className="relative group">
        <Avatar className="h-8 w-8 cursor-pointer">
          <AvatarImage src={user.image || undefined} alt={user.name || 'User'} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>

        {/* Dropdown Menu */}
        <div className="absolute right-0 top-10 w-48 bg-card border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <div className="p-3 border-b">
            <p className="font-medium truncate">{user.name || 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>

          <div className="py-1">
            <Link href="/profile">
              <button className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2">
                <User className="h-4 w-4" />
                Profile
              </button>
            </Link>

            <button
              onClick={handleSignOut}
              className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-red-500"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
