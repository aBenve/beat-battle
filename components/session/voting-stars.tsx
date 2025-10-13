'use client';

import { memo, useState, useEffect } from 'react';
import { Star } from 'lucide-react';

interface VotingStarsProps {
  currentRating: number;
  hasVoted: boolean;
  onVote: (rating: number) => Promise<void>;
}

const VotingStars = memo(function VotingStars({
  currentRating,
  hasVoted,
  onVote,
}: VotingStarsProps) {
  const [localRating, setLocalRating] = useState(currentRating);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    setLocalRating(currentRating);
  }, [currentRating]);

  const handleVote = async (rating: number) => {
    if (hasVoted || isSubmitting) return;

    // Optimistic update
    setLocalRating(rating);
    setIsSubmitting(true);

    try {
      await onVote(rating);
      // Show feedback animation
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 1000);
    } catch (error) {
      // Revert on error
      setLocalRating(currentRating);
      console.error('Error voting:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-1 relative">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          onClick={() => handleVote(rating)}
          disabled={hasVoted || isSubmitting}
          className={`transition-all ${
            hasVoted || isSubmitting
              ? 'cursor-not-allowed'
              : 'cursor-pointer hover:scale-110'
          }`}
        >
          <Star
            className={`h-6 w-6 transition-all ${
              rating <= localRating
                ? 'fill-white text-white'
                : 'text-muted'
            } ${showFeedback && rating === localRating ? 'scale-125' : ''}`}
          />
        </button>
      ))}
      {showFeedback && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs text-green-500 font-semibold animate-pulse">
          Voted!
        </div>
      )}
    </div>
  );
});

export default VotingStars;
