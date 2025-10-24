import { formatDistanceToNow, format } from 'date-fns';

export function formatEventTime(date: string | Date): string {
  const eventDate = new Date(date);
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
