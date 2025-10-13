'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Database } from '@/lib/supabase/database.types';

type Song = Database['public']['Tables']['songs']['Row'];
type Participant = Database['public']['Tables']['participants']['Row'];

interface SongItemProps {
  song: Song;
  index: number;
  isCurrentSong: boolean;
  addedBy?: Participant;
  canEdit: boolean;
  onRemove: (songId: string) => void;
}

function SortableSongItem({ song, index, isCurrentSong, addedBy, canEdit, onRemove }: SongItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song.id, disabled: !canEdit || isCurrentSong });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg ${
        isCurrentSong
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted hover:bg-muted/80'
      } ${isDragging ? 'cursor-grabbing' : ''}`}
    >
      {canEdit && !isCurrentSong && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab hover:text-primary active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      {(!canEdit || isCurrentSong) && <div className="w-4" />}

      <div className="text-sm font-semibold w-8">{index + 1}</div>

      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{song.title}</div>
        <div className="text-sm opacity-75 truncate">{song.artist}</div>
      </div>

      <div className="text-xs opacity-75 flex flex-col items-end gap-1">
        <span>{addedBy?.user_name || 'Unknown'}</span>
        <span>{formatDuration(song.duration)}</span>
      </div>

      {canEdit && !isCurrentSong && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(song.id)}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface SongQueueProps {
  songs: Song[];
  participants: Participant[];
  currentSongIndex: number;
  canEdit: boolean;
  onReorder: (newOrder: Song[]) => Promise<void>;
  onRemove: (songId: string) => Promise<void>;
}

export default function SongQueue({
  songs,
  participants,
  currentSongIndex,
  canEdit,
  onReorder,
  onRemove,
}: SongQueueProps) {
  const [localSongs, setLocalSongs] = useState(songs);

  // Update local songs when props change
  if (songs.length !== localSongs.length || songs.some((s, i) => s.id !== localSongs[i]?.id)) {
    setLocalSongs(songs);
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localSongs.findIndex((s) => s.id === active.id);
      const newIndex = localSongs.findIndex((s) => s.id === over.id);

      const newOrder = arrayMove(localSongs, oldIndex, newIndex);
      setLocalSongs(newOrder);

      try {
        await onReorder(newOrder);
      } catch (error) {
        // Revert on error
        setLocalSongs(songs);
        console.error('Failed to reorder songs:', error);
      }
    }
  };

  if (localSongs.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No songs yet. Add some to get started!
      </p>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={localSongs.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {localSongs.map((song, index) => {
            const addedBy = participants.find((p) => p.id === song.added_by);
            const isCurrentSong = index === currentSongIndex;

            return (
              <SortableSongItem
                key={song.id}
                song={song}
                index={index}
                isCurrentSong={isCurrentSong}
                addedBy={addedBy}
                canEdit={canEdit}
                onRemove={onRemove}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
