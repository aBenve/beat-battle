'use client';

import { memo, useEffect } from 'react';
import ChatMessages from './chat-messages';
import { useSessionStore } from '@/lib/store/session-store';
import type { Database } from '@/lib/supabase/database.types';

type Participant = Database['public']['Tables']['participants']['Row'];

interface ChatMessagesContainerProps {
  songId: string;
  participants: Participant[];
  currentParticipantId?: string;
}

/**
 * Container component that subscribes to chatMessages
 * This prevents the entire page from re-rendering when chat updates
 */
const ChatMessagesContainer = memo(function ChatMessagesContainer({
  songId,
  participants,
  currentParticipantId,
}: ChatMessagesContainerProps) {
  // Only this component subscribes to chatMessages
  const chatMessages = useSessionStore((state) => state.chatMessages);
  const loadChatMessages = useSessionStore((state) => state.loadChatMessages);
  const sendChatMessage = useSessionStore((state) => state.sendChatMessage);

  // Load messages when song changes
  useEffect(() => {
    loadChatMessages(songId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]); // Only re-run when songId changes, not when loadChatMessages changes

  return (
    <ChatMessages
      songId={songId}
      messages={chatMessages}
      participants={participants}
      currentParticipantId={currentParticipantId}
      onSendMessage={(message) => sendChatMessage(songId, message)}
    />
  );
});

export default ChatMessagesContainer;
