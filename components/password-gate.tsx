'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock } from 'lucide-react';

const STORAGE_KEY = 'beatbattle_auth';
const PASSWORD = process.env.NEXT_PUBLIC_SITE_PASSWORD || 'beatbattle2024';

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const auth = localStorage.getItem(STORAGE_KEY);
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password === PASSWORD) {
      localStorage.setItem(STORAGE_KEY, 'true');
      setIsAuthenticated(true);
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  // Show loading state briefly
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto"></div>
        </div>
      </div>
    );
  }

  // Show password gate if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                <Lock className="h-8 w-8" />
              </div>
            </div>
            <CardTitle className="text-2xl">BeatBattle</CardTitle>
            <CardDescription>
              This site is password protected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2">
                  Enter Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="text-center"
                />
              </div>

              {error && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm border border-destructive/20">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full">
                <Lock className="h-4 w-4 mr-2" />
                Unlock
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">
                Protected Beta Version
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show app if authenticated
  return <>{children}</>;
}
