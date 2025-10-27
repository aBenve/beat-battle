'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/lib/auth/auth-client';

export default function JoinSessionPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [sessionCode, setSessionCode] = useState('');
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill username if user is logged in
  useEffect(() => {
    if (session?.user?.name) {
      setUserName(session.user.name);
    }
  }, [session]);

  const joinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Find session by code
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_code', sessionCode.toUpperCase())
        .single();

      if (sessionError || !session) {
        throw new Error('Session not found. Please check the code and try again.');
      }

      // Extract session data to work around type inference issues
      const sessionData = session as { id: string; status: string; expires_at: string | null };

      // Check if session is still active
      if (sessionData.status === 'finished') {
        throw new Error('This session has already ended.');
      }

      // Check if session has expired
      if (sessionData.expires_at && new Date(sessionData.expires_at) < new Date()) {
        throw new Error('This session has expired.');
      }

      // Check participant limit (max 10)
      const { data: participants } = await supabase
        .from('participants')
        .select('id')
        .eq('session_id', sessionData.id);

      const maxParticipants = 10; // Enforced limit
      if (participants && participants.length >= maxParticipants) {
        throw new Error('This session is full (max 10 participants).');
      }

      // Create participant
      const participantId = crypto.randomUUID();
      const { error: participantError } = await supabase
        .from('participants')
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Supabase types issue
        .insert([
          {
            id: participantId,
            session_id: sessionData.id,
            user_name: userName,
            is_host: false,
          },
        ]);

      if (participantError) throw participantError;

      // Store participant ID in localStorage
      localStorage.setItem('participantId', participantId);
      localStorage.setItem('userName', userName);

      // Redirect to session
      router.push(`/session/${sessionData.id}`);
    } catch (err) {
      console.error('Error joining session:', err);
      setError(err instanceof Error ? err.message : 'Failed to join session. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Join BeatBattle</CardTitle>
          <CardDescription>
            Enter the session code to join
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={joinSession} className="space-y-4">
            <div>
              <label htmlFor="sessionCode" className="block text-sm font-medium mb-2">
                Session Code
              </label>
              <Input
                id="sessionCode"
                type="text"
                placeholder="ABC123"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                maxLength={10}
                required
                disabled={isLoading}
                className="text-center text-2xl font-bold tracking-widest"
              />
              <p className="text-xs text-muted-foreground mt-1 text-center">
                Enter the 6-character code
              </p>
            </div>

            <div>
              <label htmlFor="userName" className="block text-sm font-medium mb-2">
                Your Name {session?.user && <span className="text-xs text-muted-foreground">(from account)</span>}
              </label>
              <Input
                id="userName"
                type="text"
                placeholder="DJ Awesome"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
                disabled={isLoading || !!session?.user}
                readOnly={!!session?.user}
              />
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm border border-destructive/20">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Joining...' : 'Join Session'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
