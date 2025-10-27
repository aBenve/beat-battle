'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Loader2 } from 'lucide-react';
import Image from 'next/image';

interface SearchResult {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
}

interface AddSongDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddSong: (song: SearchResult) => Promise<void>;
  existingSongs: Array<{ source_id: string }>;
}

export default function AddSongDialog({ open, onOpenChange, onAddSong, existingSongs }: AddSongDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (data.results) {
        setResults(data.results);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSong = async (song: SearchResult) => {
    console.log('Attempting to add song:', song);

    // Validate song duration (max 6 minutes)
    const MAX_DURATION = 360; // 6 minutes in seconds
    if (song.duration > MAX_DURATION) {
      alert(`This song is too long! Maximum duration is 6 minutes. This song is ${formatDuration(song.duration)}.`);
      return;
    }

    setAddingId(song.id);
    try {
      await onAddSong(song);
      console.log('Song added successfully!');
      // Optionally close dialog after adding
      // onOpenChange(false);
    } catch (error) {
      console.error('Error adding song:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to add song: ${errorMessage}`);
    } finally {
      setAddingId(null);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Song</DialogTitle>
          <DialogDescription>
            Search for a song on YouTube to add to the queue
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Search for a song..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={isSearching}>
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </form>

        <div className="flex-1 overflow-y-auto space-y-2 mt-4">
          {results.length === 0 && !isSearching && (
            <p className="text-center text-muted-foreground py-8">
              Search for songs to add to your queue
            </p>
          )}

          {results.map((song) => {
            const isTooLong = song.duration > 360; // 6 minutes
            const isDuplicate = existingSongs.some((s) => s.source_id === song.id);
            const isDisabled = isTooLong || isDuplicate;

            return (
              <div
                key={song.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isDisabled ? 'opacity-50 border-destructive/50' : 'hover:bg-muted/50'
                }`}
              >
                <Image
                  src={song.thumbnail}
                  alt={song.title}
                  width={80}
                  height={60}
                  className="rounded object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{song.title}</div>
                  <div className="text-sm text-muted-foreground truncate">{song.artist}</div>
                  <div className={`text-xs mt-1 ${isDisabled ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                    {formatDuration(song.duration)}
                    {isTooLong && ' (Too long - max 6 min)'}
                    {isDuplicate && ' (Already in queue)'}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAddSong(song)}
                  disabled={addingId === song.id || isDisabled}
                  variant={isDisabled ? 'ghost' : 'default'}
                >
                  {addingId === song.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isTooLong ? (
                    'Too Long'
                  ) : isDuplicate ? (
                    'In Queue'
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
