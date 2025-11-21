import { formatDistanceToNow, format } from 'date-fns';

/**
 * Safely format event date with fallback for invalid dates
 */
export function formatEventTime(date: string | Date | null | undefined): string {
  if (!date) return 'Date unknown';
  
  const eventDate = new Date(date);
  
  // Validate date is valid
  if (isNaN(eventDate.getTime())) {
    console.warn('[formatEventTime] Invalid date:', date);
    return 'Date unknown';
  }
  
  const now = new Date();
  const diffInHours = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60);
  
  // Less than 24 hours - show relative time
  if (diffInHours < 24) {
    return formatDistanceToNow(eventDate, { addSuffix: true });
  }
  
  // Less than 7 days - show "X days ago"
  if (diffInHours < 168) {
    const days = Math.floor(diffInHours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }
  
  // Older - show actual date
  return format(eventDate, 'MMM d, yyyy');
}

/**
 * Safe date validation helper
 */
export function isValidDate(date: any): date is Date | string {
  if (!date) return false;
  const d = new Date(date);
  return !isNaN(d.getTime());
}
