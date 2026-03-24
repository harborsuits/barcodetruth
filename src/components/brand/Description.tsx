// Phrases that indicate a Wikipedia disambiguation leak rather than a real brand description
const DISAMBIGUATION_PATTERNS = [
  /\bmay refer to\b/i,
  /\bcan refer to\b/i,
  /\bmay also refer to\b/i,
  /\bdisambiguation\b/i,
  /\bin computer graphics\b/i,
  /\bin folklore\b/i,
  /\bmythological\b/i,
  /\bmythical\b/i,
  /\bin mythology\b/i,
  /\bis a genus\b/i,
  /\bis a species\b/i,
  /\bis a fictional\b/i,
  /\bis a character\b/i,
];

function looksLikeDisambiguation(text: string): boolean {
  return DISAMBIGUATION_PATTERNS.some(p => p.test(text));
}

export function Description({ description, wikiUrl }: { description?: string; wikiUrl?: string }) {
  if (!description) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="animate-pulse">●</span>
        <span>Auto-enriching from Wikipedia…</span>
      </div>
    );
  }

  // Guard: if the description looks like disambiguation noise, don't show it
  if (looksLikeDisambiguation(description)) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-destructive">⚠</span>
        <span>Description under review — awaiting verified summary.</span>
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
