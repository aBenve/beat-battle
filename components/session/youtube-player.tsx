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
        event.target.playVideo().then(() => {
          setIsPlaying(true);
        }).catch((err: unknown) => {
          console.log('Autoplay blocked, user interaction needed:', err);
          setIsPlaying(false);
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
        if (playerState === 2 && isPlaying) {
          console.log('Player is paused, forcing play...');
          player.playVideo();
        } else if (playerState === 1) {
          setIsPlaying(true);
        }

        // Check if out of sync by more than 3 seconds
        const currentTime = await player.getCurrentTime();
        const expectedTime = getExpectedPlaybackTime();
        const drift = Math.abs(currentTime - expectedTime);

        if (drift > 3) {
          console.log(`Out of sync by ${drift}s, resyncing to ${expectedTime}s`);
          player.seekTo(expectedTime, true);
          player.playVideo();
        }
      } catch (error) {
        console.error('Error during sync check:', error);
      }
    }, 5000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [sessionStartedAt, videoId, isPlaying, getExpectedPlaybackTime]);

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

      {/* Overlay to prevent clicks on video - only show when playing */}
      <div className="absolute inset-0 z-10 cursor-default" />

      {/* Play button overlay when not playing */}
      {/* {!isPlaying && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
          <button
            onClick={handlePlayClick}
            className="flex items-center justify-center w-20 h-20 rounded-full bg-white/90 hover:bg-white transition-all hover:scale-110"
          >
            <svg
              className="w-10 h-10 ml-1 text-black"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      )} */}
    </div>
  );
});

export default YouTubePlayerComponent;
