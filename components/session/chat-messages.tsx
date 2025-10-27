'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send, ChevronDown, ChevronUp } from 'lucide-react';
import type { Database } from '@/lib/supabase/database.types';

type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];
type Participant = Database['public']['Tables']['participants']['Row'];

interface ChatMessagesProps {
  songId: string;
  messages: ChatMessage[];
  participants: Participant[];
  currentParticipantId?: string;
  onSendMessage: (message: string) => Promise<void>;
}

/**
 * Simple collapsible chat component
 */
export default function ChatMessages({
  messages,
  participants,
  currentParticipantId,
  onSendMessage,
}: ChatMessagesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive (only if open)
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(inputMessage.trim());
      setInputMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const getParticipantName = (participantId: string) => {
    const participant = participants.find(p => p.id === participantId);
    return participant?.user_name || 'Unknown';
  };

  return (
    <div className="border rounded-lg bg-card">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Chat</span>
          {messages.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({messages.length})
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div className="border-t">
          {/* Messages */}
          <div className="max-h-60 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No messages yet
              </p>
            ) : (
              messages.map((message) => {
                const isCurrentUser = message.participant_id === currentParticipantId;
                const senderName = getParticipantName(message.participant_id);

                return (
                  <div
                    key={message.id}
                    className="text-xs"
                  >
                    <span className="font-medium">
                      {isCurrentUser ? 'You' : senderName}:
                    </span>{' '}
                    <span>{message.message}</span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Type a message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isSending}
                className="flex-1 text-sm h-8"
                maxLength={500}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!inputMessage.trim() || isSending}
                className="h-8 w-8 p-0"
              >
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
