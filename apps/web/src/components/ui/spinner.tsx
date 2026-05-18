import React from 'react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Spinner({ className, size = 'md' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 drop-shadow-[0_0_4px_rgba(59,130,246,0.3)]',
    md: 'h-8 w-8 drop-shadow-[0_0_8px_rgba(59,130,246,0.35)]',
    lg: 'h-16 w-16 drop-shadow-[0_0_16px_rgba(59,130,246,0.4)]',
    xl: 'h-24 w-24 drop-shadow-[0_0_24px_rgba(59,130,246,0.5)]',
  };

  return (
    <img
      src="/images/loader.svg"
      alt="Loading..."
      className={cn('animate-spin select-none pointer-events-none', sizeClasses[size], className)}
    />
  );
}
