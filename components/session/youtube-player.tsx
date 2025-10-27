'use client';

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(false);

  const opts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: autoplay ? 1 : 0,
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

  // Calculate what the current playback time should be based on session start time
  const getExpectedPlaybackTime = useCallback(() => {
    if (!sessionStartedAt) return startTime;
    const startTime_ms = new Date(sessionStartedAt).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - startTime_ms) / 1000);
    return elapsed;
  }, [sessionStartedAt, startTime]);

  const handleReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;

    // Try to play automatically
    try {
      const expectedTime = getExpectedPlaybackTime();

      event.target.seekTo(expectedTime, true);

      if (autoplay) {
        // Try to play - if blocked, show play button
        event.target.playVideo().then(() => {
          setIsPlaying(true);
          setShowPlayButton(false);
        }).catch((err: unknown) => {
          console.log('Autoplay blocked by browser, showing play button:', err);
          setIsPlaying(false);
          setShowPlayButton(true);
        });
      }
    } catch (error) {
      console.error('Error autoplaying video:', error);
      setIsPlaying(false);
    }

    onReady?.();
  };

  const handleEnd: YouTubeProps['onEnd'] = () => {
    onEnd();
  };

  const handleManualPlay = async () => {
    if (!playerRef.current) return;

    try {
      const expectedTime = getExpectedPlaybackTime();
      await playerRef.current.seekTo(expectedTime, true);
      await playerRef.current.playVideo();
      setIsPlaying(true);
      setShowPlayButton(false);
    } catch (error) {
      console.error('Error playing video:', error);
    }
  };

  // Force play when sessionStartedAt changes (song changed)
  useEffect(() => {
    if (!playerRef.current || !sessionStartedAt || !autoplay) return;

    console.log('[YouTubePlayer] Session start time changed, forcing sync and play');

    // Give the player a moment to be ready
    const timeout = setTimeout(async () => {
      try {
        const player = playerRef.current;
        if (!player) return;

        const expectedTime = getExpectedPlaybackTime();
        console.log('[YouTubePlayer] Seeking to', expectedTime, 'and playing');

        await player.seekTo(expectedTime, true);
        await player.playVideo();
        setIsPlaying(true);
        setShowPlayButton(false);
      } catch (error) {
        console.error('[YouTubePlayer] Error forcing playback:', error);
        setShowPlayButton(true);
      }
    }, 100);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStartedAt, autoplay]); // Removed getExpectedPlaybackTime - causes infinite re-sync

  // Sync playback with session time
  useEffect(() => {
    if (!playerRef.current || !sessionStartedAt) return;

    // Check sync every 5 seconds
    syncIntervalRef.current = setInterval(async () => {
      try {
        const player = playerRef.current;
        if (!player) return;

        const playerState = await player.getPlayerState();

        // If paused (state 2), force play
        if (playerState === 2 && autoplay) {
          console.log('[YouTubePlayer] Player is paused, forcing play...');
          player.playVideo();
        } else if (playerState === 1) {
          setIsPlaying(true);
        }

        // Check if out of sync by more than 3 seconds
        const currentTime = await player.getCurrentTime();
        const expectedTime = getExpectedPlaybackTime();
        const drift = Math.abs(currentTime - expectedTime);

        if (drift > 3) {
          console.log(`[YouTubePlayer] Out of sync by ${drift}s, resyncing to ${expectedTime}s`);
          player.seekTo(expectedTime, true);
          if (autoplay) {
            player.playVideo();
          }
        }
      } catch (error) {
        console.error('[YouTubePlayer] Error during sync check:', error);
      }
    }, 5000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStartedAt, videoId, autoplay]); // Removed getExpectedPlaybackTime - it's stable within the interval

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      if (playerRef.current) {
        playerRef.current.destroy();
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
        onEnd={handleEnd}
        className="absolute inset-0"
        iframeClassName="w-full h-full"
      />

      {/* Play button overlay when autoplay is blocked */}
      {showPlayButton && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
          <button
            onClick={handleManualPlay}
            className="flex items-center justify-center w-20 h-20 rounded-full bg-white/90 hover:bg-white transition-all hover:scale-110 shadow-2xl"
          >
            <svg
              className="w-10 h-10 ml-1 text-black"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <p className="text-white text-sm mt-4">
            Click to play
          </p>
        </div>
      )}

      {/* Overlay to prevent clicks on video - only show when playing */}
      <div className="absolute inset-0 z-10 cursor-default" />
    </div>
  );
});

export default YouTubePlayerComponent;
