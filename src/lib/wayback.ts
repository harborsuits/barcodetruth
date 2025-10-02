export type ArchiveResult = { archiveUrl?: string; status: number; note?: string };

export async function saveToWayback(url: string, timeoutMs = 8000): Promise<ArchiveResult> {
  try {
    const api = `https://web.archive.org/save/${encodeURIComponent(url)}`;
    const res = await fetch(api, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    
    // Wayback responds with 200/Content-Location or 429/503 when throttled
    const archive = res.headers.get('Content-Location') || res.headers.get('X-Archive-Orig-Location');
    
    // Sometimes the capture is queued; still return best-guess URL:
    const archiveUrl = archive
      ? `https://web.archive.org${archive}`
      : res.headers.get('Memento-Datetime')
        ? `https://web.archive.org/web/*/${url}`
        : undefined;
    
    return { archiveUrl, status: res.status };
  } catch (e: any) {
    return { status: 0, note: e?.message || 'wayback error' };
  }
}
