// src/components/ui/StarRating.tsx
'use client';

import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  className?: string;
}

export default function StarRating({
  rating,
  onRatingChange,
  readOnly = true,
  size = 'md',
  showValue = true,
  className = ''
}: StarRatingProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const handleStarClick = (starRating: number) => {
    if (!readOnly && onRatingChange) {
      onRatingChange(starRating);
    }
  };

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => handleStarClick(star)}
          disabled={readOnly}
          className={`transition-colors ${
            !readOnly ? 'hover:scale-110 cursor-pointer' : 'cursor-default'
          } ${!readOnly ? 'hover:bg-gray-700 p-1 rounded' : ''}`}
        >
          <Star
            className={`${sizeClasses[size]} transition-all ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-600'
            }`}
          />
        </button>
      ))}
      
      {showValue && (
        <span className={`${textSizeClasses[size]} text-gray-300 ml-2 font-medium`}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}