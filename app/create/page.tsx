'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';

export default function CreateSessionPage() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState('');
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Check active session limit (max 20)
      // Note: This requires the database migration to be run first
      // Fallback to client-side count if function doesn't exist
      let activeCount = 0;

      try {
        const { data, error: countError } = await supabase
          .rpc('count_active_sessions');

        if (countError) {
          // Function doesn't exist yet, use fallback
          console.warn('count_active_sessions function not found, using fallback count');
          const { data: sessions, error: sessionsError } = await supabase
            .from('sessions')
            .select('id, status, expires_at')
            .in('status', ['waiting', 'playing']);

          if (!sessionsError && sessions) {
            // Count non-expired sessions
            const now = new Date();
            activeCount = sessions.filter(s => {
              if (!s.expires_at) return true; // No expiration set, count it
              return new Date(s.expires_at) > now;
            }).length;
          }
        } else {
          activeCount = data;
        }
      } catch (rpcError) {
        console.warn('Error checking session count:', rpcError);
        // Proceed with creation if we can't check
      }

      if (activeCount >= 20) {
        throw new Error('Maximum number of active sessions reached. Please try again later.');
      }

      // Generate session code
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_session_code');

      if (codeError) throw codeError;

      const sessionCode = codeData as string;

      // Create host participant first (we'll use this ID as host_id)
      const hostId = crypto.randomUUID();

      // Create session
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert([
          {
            name: sessionName,
            host_id: hostId,
            session_code: sessionCode,
            status: 'waiting',
          },
        ])
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Add host as participant
      const { error: participantError } = await supabase
        .from('participants')
        .insert([
          {
            id: hostId,
            session_id: session.id,
            user_name: userName,
            is_host: true,
          },
        ]);

      if (participantError) throw participantError;

      // Store participant ID in localStorage
      localStorage.setItem('participantId', hostId);
      localStorage.setItem('userName', userName);

      // Redirect to session
      router.push(`/session/${session.id}`);
    } catch (err) {
      console.error('Error creating session:', err);
      setError('Failed to create session. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Create BeatBattle</CardTitle>
          <CardDescription>
            Set up your music competition session
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createSession} className="space-y-4">
            <div>
              <label htmlFor="sessionName" className="block text-sm font-medium mb-2">
                Session Name
              </label>
              <Input
                id="sessionName"
                type="text"
                placeholder="Friday Night Vibes"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="userName" className="block text-sm font-medium mb-2">
                Your Name
              </label>
              <Input
                id="userName"
                type="text"
                placeholder="DJ Awesome"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
                disabled={isLoading}
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
                {isLoading ? 'Creating...' : 'Create Session'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
