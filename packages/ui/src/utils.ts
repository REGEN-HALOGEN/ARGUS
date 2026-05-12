import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely with clsx */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
