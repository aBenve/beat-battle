'use client';

import { Play, VolumeX, Volume2 } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import YouTube, { YouTubePlayer, YouTubeProps } from 'react-youtube';

interface YouTubePlayerComponentProps {
  videoId: string;
  onEnd: () => void;
  onReady?: () => void;
  startTime?: number;
  autoplay?: boolean;
  sessionStartedAt?: string; // When the song started playing in the session
}

const USER_INTERACTION_KEY = 'beat-battle-user-interacted';
const USER_UNMUTED_KEY = 'beat-battle-user-unmuted';

const YouTubePlayerComponent = memo(function YouTubePlayerComponent({
  videoId,
  onEnd,
  onReady,
  startTime = 0,
  autoplay = true,
  sessionStartedAt,
}: YouTubePlayerComponentProps) {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [playerState, setPlayerState] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hasUnmuted, setHasUnmuted] = useState(false);
  const [showUnmutedConfirmation, setShowUnmutedConfirmation] = useState(false);

  const opts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: autoplay ? 1 : 0,
      mute: 1, // CRITICAL: Start muted for reliable autoplay
      start: startTime,
      controls: 0, // Disable controls for sync
      disablekb: 1, // Disable keyboard controls
      modestbranding: 1,
      rel: 0,
      fs: 0, // Disable fullscreen
      iv_load_policy: 3, // Disable annotations
      playsinline: 1, // Play inline on mobile
      enablejsapi: 1, // Enable JS API
    },
  };

  // User interaction helpers
  const hasUserInteracted = (): boolean => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(USER_INTERACTION_KEY) === 'true';
  };

  const markUserInteraction = (): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(USER_INTERACTION_KEY, 'true');
  };

  const hasUserUnmuted = (): boolean => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(USER_UNMUTED_KEY) === 'true';
  };

  const markUserUnmuted = (): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(USER_UNMUTED_KEY, 'true');
  };

  // Calculate what the current playback time should be based on session start time
  const getExpectedPlaybackTime = useCallback(() => {
    if (!sessionStartedAt) return startTime;
    const startTime_ms = new Date(sessionStartedAt).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - startTime_ms) / 1000);
    return Math.max(0, elapsed);
  }, [sessionStartedAt, startTime]);

  // Unmute handler
  const handleUnmute = async () => {
    if (!playerRef.current || hasUnmuted) return;

    try {
      await playerRef.current.unMute();
      setIsMuted(false);
      setHasUnmuted(true);
      markUserUnmuted();
      setShowUnmutedConfirmation(true);
      console.log('[YouTubePlayer] Unmuted successfully');

      // Hide confirmation after 2 seconds
      setTimeout(() => setShowUnmutedConfirmation(false), 2000);
    } catch (error) {
      console.error('[YouTubePlayer] Error unmuting:', error);
    }
  };

  // Try autoplay with proper error handling (muted autoplay)
  const tryAutoplay = async (): Promise<boolean> => {
    if (!playerRef.current) return false;

    try {
      const expectedTime = getExpectedPlaybackTime();
      playerRef.current.seekTo(expectedTime, true);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Player is already muted from opts, just play
      playerRef.current.playVideo();
      await new Promise(resolve => setTimeout(resolve, 500));

      const state = await playerRef.current.getPlayerState();

      if (state === 1 || state === 3) {
        console.log('[YouTubePlayer] Muted autoplay succeeded');
        setIsPlaying(true);
        setShowPlayButton(false);
        setIsMuted(true);
        return true;
      }

      console.log('[YouTubePlayer] Autoplay failed, state:', state);
      setShowPlayButton(true);
      return false;
    } catch (error) {
      console.error('[YouTubePlayer] Autoplay error:', error);
      setShowPlayButton(true);
      return false;
    }
  };

  // Handle player ready
  const handleReady: YouTubeProps['onReady'] = async (event) => {
    playerRef.current = event.target;

    const expectedTime = getExpectedPlaybackTime();
    event.target.seekTo(expectedTime, true);

    if (!autoplay) {
      onReady?.();
      return;
    }

    console.log('[YouTubePlayer] Ready - Starting muted autoplay');

    // Always try muted autoplay (should work 95%+ of the time)
    await tryAutoplay();

    onReady?.();
  };

  // Handle player state changes
  const handleStateChange: YouTubeProps['onStateChange'] = (event) => {
    const state = event.data;
    setPlayerState(state);

    const stateNames: Record<number, string> = {
      '-1': 'unstarted',
      '0': 'ended',
      '1': 'playing',
      '2': 'paused',
      '3': 'buffering',
      '5': 'cued',
    };

    console.log('[YouTubePlayer] State:', stateNames[state] || 'unknown');

    if (state === 1) {
      setIsPlaying(true);
      setShowPlayButton(false);
    } else if (state === 2) {
      setIsPlaying(false);
    }
  };

  // Handle song end
  const handleEnd: YouTubeProps['onEnd'] = () => {
    onEnd();
  };

  // Manual play handler
  const handleManualPlay = async () => {
    if (!playerRef.current) return;

    markUserInteraction();

    try {
      const expectedTime = getExpectedPlaybackTime();
      playerRef.current.seekTo(expectedTime, true);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Unmute when user manually plays
      if (!hasUnmuted) {
        await handleUnmute();
      }

      playerRef.current.playVideo();
      await new Promise(resolve => setTimeout(resolve, 300));

      const state = await playerRef.current.getPlayerState();

      if (state === 1 || state === 3) {
        setIsPlaying(true);
        setShowPlayButton(false);
        console.log('[YouTubePlayer] Manual play successful');
      }
    } catch (error) {
      console.error('[YouTubePlayer] Manual play error:', error);
    }
  };

  // Listen for ANY user interaction to unmute
  useEffect(() => {
    if (hasUnmuted) return;

    const handleInteraction = () => {
      markUserInteraction();
      handleUnmute();
    };

    // Listen to multiple interaction types
    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('touchstart', handleInteraction, { once: true });
    document.addEventListener('keydown', handleInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, [hasUnmuted]);

  // Auto-unmute if user has unmuted before
  useEffect(() => {
    if (hasUserUnmuted() && !hasUnmuted && playerRef.current) {
      console.log('[YouTubePlayer] User has unmuted before, auto-unmuting');
      setTimeout(() => handleUnmute(), 1000);
    }
  }, [hasUnmuted]);

  // Force play when sessionStartedAt changes (song changed)
  useEffect(() => {
    if (!playerRef.current || !sessionStartedAt || !autoplay) return;

    console.log('[YouTubePlayer] Session start time changed, forcing sync and play');

    const timeout = setTimeout(async () => {
      // Always try muted autoplay on song change
      await tryAutoplay();
    }, 100);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStartedAt, autoplay]);

  // Sync playback with session time
  useEffect(() => {
    if (!playerRef.current || !sessionStartedAt) return;

    // Don't start sync immediately, give initial play a chance
    const initialDelay = setTimeout(() => {
      syncIntervalRef.current = setInterval(async () => {
        try {
          const player = playerRef.current;
          if (!player) return;

          const state = await player.getPlayerState();

          // Only force play if truly paused (not buffering)
          if (state === 2 && autoplay) {
            console.log('[YouTubePlayer] Sync: Player is paused, forcing play...');

            if (hasUserInteracted()) {
              player.playVideo();
            } else {
              // Show play button if no interaction yet
              setShowPlayButton(true);
            }
          } else if (state === 1) {
            // Playing correctly
            setIsPlaying(true);
            setShowPlayButton(false);

            // Check sync drift
            const currentTime = await player.getCurrentTime();
            const expectedTime = getExpectedPlaybackTime();
            const drift = Math.abs(currentTime - expectedTime);

            if (drift > 3) {
              console.log(`[YouTubePlayer] Sync: Out of sync by ${drift}s, resyncing...`);
              player.seekTo(expectedTime, true);
            }
          } else if (state === 3) {
            // Buffering is okay, don't interfere
            console.log('[YouTubePlayer] Sync: Buffering...');
          }
        } catch (error) {
          console.error('[YouTubePlayer] Sync error:', error);
        }
      }, 5000);
    }, 2000); // Wait 2 seconds before starting sync

    return () => {
      clearTimeout(initialDelay);
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStartedAt, videoId, autoplay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // Ignore destroy errors
        }
      }
    };
  }, []);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      {/* YouTube Player */}
      <YouTube
        videoId={videoId}
        opts={opts}
        onReady={handleReady}
        onStateChange={handleStateChange}
        onEnd={handleEnd}
        className="absolute inset-0"
        iframeClassName="w-full h-full"
      />

      {/* Muted indicator - show when playing and muted */}
      {isPlaying && isMuted && !hasUnmuted && (
        <div
          className="absolute top-4 left-4 z-15 bg-black/70 backdrop-blur-sm rounded-full px-3 py-2 cursor-pointer hover:bg-black/80 transition-colors"
          onClick={handleUnmute}
        >
          <div className="flex items-center gap-2 text-white text-sm">
            <VolumeX className="h-4 w-4 animate-pulse" />
            <span>Click anywhere to unmute</span>
          </div>
        </div>
      )}

      {/* Unmuted confirmation - brief confirmation */}
      {showUnmutedConfirmation && (
        <div className="absolute top-4 left-4 z-15 bg-green-500/70 backdrop-blur-sm rounded-full px-3 py-2 animate-in fade-in slide-in-from-left duration-300">
          <div className="flex items-center gap-2 text-white text-sm">
            <Volume2 className="h-4 w-4" />
            <span>Sound on</span>
          </div>
        </div>
      )}

      {/* Buffering indicator */}
      {isPlaying && playerState === 3 && (
        <div className="absolute top-4 right-4 z-15 bg-black/50 rounded-full px-3 py-1">
          <div className="flex items-center gap-2 text-white text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            <span>Buffering...</span>
          </div>
        </div>
      )}

      {/* Play button overlay when autoplay is blocked */}
      {showPlayButton && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <button
            onClick={handleManualPlay}
            className="flex items-center justify-center size-16 rounded-full bg-primary hover:bg-primary/90 transition-all hover:scale-110 shadow-2xl"
          >
            <Play className="size-8 fill-primary-foreground" />
          </button>
          <div className="mt-6 text-center px-4">
            <p className="text-white text-lg font-semibold">
              Click to start playback
            </p>
            <p className="text-white/70 text-sm mt-1">
              Will play with sound
            </p>
          </div>
        </div>
      )}

      {/* Overlay to prevent clicks on video - only show when playing */}
      <div className="absolute inset-0 z-10 cursor-default" />
    </div>
  );
});

export default YouTubePlayerComponent;
