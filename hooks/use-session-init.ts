import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/lib/store/session-store';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/lib/auth/auth-client';

/**
 * Custom hook to handle session initialization
 * Loads session data and sets up realtime subscriptions
 * Auto-joins group members if they're not already participants
 */
export function useSessionInit(sessionId: string) {
  const router = useRouter();
  const { data: authSession } = useSession();
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = useSessionStore((state) => state.loadSession);
  const subscribeToSession = useSessionStore((state) => state.subscribeToSession);
  const unsubscribeFromSession = useSessionStore((state) => state.unsubscribeFromSession);
  const setCurrentParticipant = useSessionStore((state) => state.setCurrentParticipant);

  useEffect(() => {
    const init = async () => {
      try {
        // Get participant from localStorage
        let participantId = localStorage.getItem('participantId');
        const userEmail = authSession?.user?.email;
        const userName = authSession?.user?.name || localStorage.getItem('userName');

        console.log('[useSessionInit] Starting init with participantId from localStorage:', participantId);

        // 1. Load session data first
        await loadSession(sessionId);

        const storeSession = useSessionStore.getState().session;
        const storeParticipants = useSessionStore.getState().participants;

        // Verify that the participantId from localStorage belongs to THIS session
        const participantBelongsToSession = participantId && storeParticipants.some(p => p.id === participantId);

        if (participantId && !participantBelongsToSession) {
          console.log('[useSessionInit] ParticipantId from localStorage does not belong to this session, clearing it');
          participantId = null;
          localStorage.removeItem('participantId');
        }

        // 2. Check if user is a group member and auto-join if needed
        if (userEmail && !participantId) {
          console.log('[useSessionInit] No participantId, checking for group membership');

          // Check if this session is part of a group
          const { data: groupSessions } = await supabase
            .from('group_sessions')
            .select('group_id')
            .eq('session_id', sessionId);

          console.log('[useSessionInit] Group sessions found:', groupSessions?.length || 0);

          if (groupSessions && groupSessions.length > 0) {
            const groupId = groupSessions[0].group_id;
            console.log('[useSessionInit] Session belongs to group:', groupId);

            // Check if user is a member of this group
            const { data: groupMember } = await supabase
              .from('group_members')
              .select('*')
              .eq('group_id', groupId)
              .eq('user_email', userEmail.toLowerCase())
              .single();

            console.log('[useSessionInit] Group member found:', !!groupMember);

            if (groupMember && storeSession) {
              // Check if there's already a participant for this session (maybe from a previous visit)
              const existingParticipant = storeParticipants.find(p =>
                p.user_name === groupMember.user_name ||
                p.user_name === userName
              );

              if (existingParticipant) {
                console.log('[useSessionInit] Found existing participant, reusing:', existingParticipant.id);
                participantId = existingParticipant.id;
                localStorage.setItem('participantId', existingParticipant.id);
              } else {
                // User is a group member but not a participant - auto-join
                console.log('[useSessionInit] Auto-joining group member to session');

              const newParticipantId = crypto.randomUUID();
              const participantName = userName || groupMember.user_name;

              const { error: joinError } = await supabase
                .from('participants')
                .insert({
                  id: newParticipantId,
                  session_id: sessionId,
                  user_name: participantName,
                  is_host: false,
                });

              if (joinError) {
                console.error('[useSessionInit] Error auto-joining:', joinError);
              } else {
                // Save participant ID and name
                participantId = newParticipantId;
                localStorage.setItem('participantId', newParticipantId);
                localStorage.setItem('userName', participantName);

                console.log('[useSessionInit] Participant created:', newParticipantId, participantName);

                // Reload session to get updated participants
                await loadSession(sessionId);

                // Verify participant was loaded
                const reloadedParticipants = useSessionStore.getState().participants;
                console.log('[useSessionInit] Reloaded participants:', reloadedParticipants.length);
                const newParticipant = reloadedParticipants.find((p) => p.id === newParticipantId);
                if (newParticipant) {
                  console.log('[useSessionInit] Found new participant in store:', newParticipant);
                } else {
                  console.error('[useSessionInit] New participant not found in store after reload!');
                }
              }
              }
            }
          }
        }

        if (!participantId) {
          console.error('[useSessionInit] No participantId found, redirecting to home');
          router.push('/');
          return;
        }

        console.log('[useSessionInit] Using participantId:', participantId);

        // 3. Set current participant (needed for presence tracking)
        const updatedParticipants = useSessionStore.getState().participants;
        console.log('[useSessionInit] Total participants in store:', updatedParticipants.length);
        console.log('[useSessionInit] Looking for participant:', participantId);

        const participant = updatedParticipants.find((p) => p.id === participantId);
        if (participant) {
          console.log('[useSessionInit] Setting current participant:', participant);
          setCurrentParticipant(participant);
        } else {
          console.error('[useSessionInit] Participant not found in store! ParticipantId:', participantId);
          console.error('[useSessionInit] Available participants:', updatedParticipants.map(p => ({ id: p.id, name: p.user_name })));
        }

        // 4. Subscribe to real-time updates (AFTER participant is set)
        await subscribeToSession(sessionId);

        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing session:', error);
        router.push('/');
      }
    };

    init();

    return () => {
      unsubscribeFromSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, router]); // Only sessionId and router - store functions cause infinite loops

  return { isLoading };
}
