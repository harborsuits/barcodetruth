interface LastUpdatedBadgeProps {
  timestamp?: string;
}

export function LastUpdatedBadge({ timestamp }: LastUpdatedBadgeProps) {
  if (!timestamp) return null;
  
  const now = Date.now();
  const updated = new Date(timestamp).getTime();
  const diffMs = now - updated;
  const diffMins = Math.max(1, Math.round(diffMs / 60000));
  
  let displayText: string;
  if (diffMins < 60) {
    displayText = `${diffMins}m ago`;
  } else if (diffMins < 1440) {
    const hours = Math.round(diffMins / 60);
    displayText = `${hours}h ago`;
  } else {
    const days = Math.round(diffMins / 1440);
    displayText = `${days}d ago`;
  }
  
  return (
    <span className="text-xs text-muted-foreground" title={new Date(timestamp).toLocaleString()}>
      Updated {displayText}
    </span>
  );
}
