export function EventTimeline({ items }: { 
  items: Array<{
    date: string; 
    title?: string; 
    category: string; 
    effective_delta?: number;
    verification?: string; 
    source_name?: string;
  }> 
}) {
  if (!items?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">Event coverage expanding</p>
        <p className="text-xs mt-1">No verified events for this brand yet</p>
      </div>
    );
  }

  return (
    <ol className="relative border-s border-muted pl-4 space-y-3">
      {items.map((it, i) => (
        <li key={i}>
          <div className="absolute -start-1 mt-1 h-2 w-2 rounded-full bg-muted-foreground" />
          <div className="text-xs text-muted-foreground">
            {new Date(it.date).toLocaleDateString()}
          </div>
          <div className="text-sm">
            <span className="font-medium capitalize">{it.category}</span>
            {typeof it.effective_delta === 'number' && (
              <span className={`ml-2 ${it.effective_delta < 0 ? 'text-destructive' : ''}`}>
                {it.effective_delta > 0 ? '+' : ''}{Math.round(it.effective_delta)}
              </span>
            )}
          </div>
          <div className="text-sm text-foreground">{it.title || it.source_name}</div>
          {it.verification && (
            <div className="text-xs text-muted-foreground">Verified: {it.verification}</div>
          )}
        </li>
      ))}
    </ol>
  );
}
