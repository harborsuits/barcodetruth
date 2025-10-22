export function Description({ description, wikiUrl }: { description?: string; wikiUrl?: string }) {
  if (!description) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="animate-pulse">●</span>
        <span>Auto-enriching from Wikipedia…</span>
      </div>
    );
  }
  const short = description.length > 200 ? `${description.slice(0, 200)}…` : description;
  return (
    <p className="text-sm leading-6">
      {short}{" "}
      {wikiUrl && (
        <a
          className="underline text-muted-foreground hover:text-foreground"
          href={wikiUrl}
          target="_blank"
          rel="noreferrer"
        >
          Source
        </a>
      )}
    </p>
  );
}
