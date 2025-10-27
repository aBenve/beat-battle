'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/lib/auth/auth-client';
import type { Database } from '@/lib/supabase/database.types';

type Group = Database['public']['Tables']['groups']['Row'];
type GroupMember = Database['public']['Tables']['group_members']['Row'];

export default function CreateSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupId = searchParams.get('groupId');
  const { data: session } = useSession();

  const [sessionName, setSessionName] = useState('');
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [group, setGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);

  // Load group data if groupId is provided
  useEffect(() => {
    if (groupId) {
      loadGroupData(groupId);
    }
  }, [groupId]);

  // Auto-fill username if user is logged in
  useEffect(() => {
    if (session?.user?.name) {
      setUserName(session.user.name);
    }
  }, [session]);

  const loadGroupData = async (id: string) => {
    try {
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);
      setSessionName(`${groupData.name} Session`);

      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', id);

      if (membersError) throw membersError;
      setGroupMembers(membersData || []);
    } catch (err) {
      console.error('Error loading group:', err);
      setError('Failed to load group details');
    }
  };

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
            activeCount = sessions.filter((s: { expires_at: string | null }) => {
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
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Supabase types issue
        .insert({
          name: sessionName,
          host_id: hostId,
          session_code: sessionCode,
          status: 'waiting',
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      if (!session) throw new Error('Session not created');

      // Extract session ID to work around type inference issue
      const sessionId_forInsert = (session as { id: string }).id;

      // Add host as participant
      const { error: participantError } = await supabase
        .from('participants')
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Supabase types issue
        .insert([
          {
            id: hostId,
            session_id: sessionId_forInsert,
            user_name: userName,
            is_host: true,
          },
        ]);

      if (participantError) throw participantError;

      // Store participant ID in localStorage
      localStorage.setItem('participantId', hostId);
      localStorage.setItem('userName', userName);

      // If this session is for a group, link it
      if (groupId) {
        const { error: linkError } = await supabase
          .from('group_sessions')
          .insert({
            group_id: groupId,
            session_id: sessionId_forInsert,
          });

        if (linkError) {
          console.error('Error linking session to group:', linkError);
          // Don't fail session creation if linking fails
        }

        // Add all group members as participants (except host, who is already added)
        const currentUserEmail = localStorage.getItem('userEmail');
        const otherMembers = groupMembers.filter(m => m.user_email !== currentUserEmail);

        if (otherMembers.length > 0) {
          const participantInserts = otherMembers.map(member => ({
            id: crypto.randomUUID(),
            session_id: sessionId_forInsert,
            user_name: member.user_name,
            is_host: false,
          }));

          const { error: membersError } = await supabase
            .from('participants')
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - Supabase types issue
            .insert(participantInserts);

          if (membersError) {
            console.error('Error adding group members:', membersError);
            // Don't fail session creation if adding members fails
          }
        }
      }

      // Redirect to session
      router.push(`/session/${sessionId_forInsert}`);
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
            {group ? `Starting a session for ${group.name}` : 'Set up your music competition session'}
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
                {isLoading ? 'Creating...' : 'Create Session'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
