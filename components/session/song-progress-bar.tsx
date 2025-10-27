'use client';

import { memo, useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';

interface SongProgressBarProps {
  duration: number; // Total duration in seconds
  startedAt: string; // ISO timestamp when song started
  className?: string;
}

const SongProgressBar = memo(function SongProgressBar({
  duration,
  startedAt,
  className = '',
}: SongProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const calculateProgress = () => {
      const startTime = new Date(startedAt).getTime();
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);

      // Clamp between 0 and duration
      const clampedElapsed = Math.max(0, Math.min(elapsedSeconds, duration));
      const progressPercent = (clampedElapsed / duration) * 100;

      setElapsed(clampedElapsed);
      setProgress(progressPercent);
    };

    // Calculate immediately
    calculateProgress();

    // Update every second using requestAnimationFrame for smoother updates
    let rafId: number;
    let lastTime = Date.now();

    const animate = () => {
      const now = Date.now();

      // Only update once per second to avoid too many renders
      if (now - lastTime >= 1000) {
        calculateProgress();
        lastTime = now;
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [startedAt, duration]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Mark the 30% threshold for skip voting
  const skipThreshold = 30;
  const canSkip = progress >= skipThreshold;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatTime(elapsed)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <div className="relative">
        <Progress value={progress} className="h-2" />

        {/* Skip threshold indicator */}
        <div
          className="absolute top-0 h-full w-0.5 bg-yellow-500/50"
          style={{ left: `${skipThreshold}%` }}
          title="Skip voting enabled after 30%"
        />

        {/* Visual feedback when skip is available */}
        {canSkip && (
          <div
            className="absolute -bottom-1 left-0 right-0 h-0.5 bg-yellow-500/30 animate-pulse"
            style={{ marginLeft: `${skipThreshold}%` }}
          />
        )}
      </div>

      {canSkip && (
        <p className="text-xs text-yellow-500 text-center">
          Skip voting available
        </p>
      )}
    </div>
  );
});

export default SongProgressBar;
