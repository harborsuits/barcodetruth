import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import type { BrandProofResponse } from '@/types/evidence';

export default function BrandProof() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<BrandProofResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchProof = async () => {
      try {
        setLoading(true);
        const { data: result, error: fnError } = await supabase.functions.invoke('get-brand-proof', {
          body: { brandId: id },
        });

        if (fnError) throw fnError;
        setData(result);
      } catch (e: any) {
        console.error('Failed to load proof:', e);
        setError(e?.message || 'Failed to load proof data');
      } finally {
        setLoading(false);
      }
    };

    fetchProof();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="rounded-xl border border-destructive bg-destructive/10 p-4 text-destructive">
          {error || 'Failed to load proof data'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <header className="flex items-baseline justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold text-foreground">{data.brandName} · Evidence</h1>
        <div className="text-sm text-muted-foreground">
          Updated {new Date(data.updatedAt).toLocaleString()}
        </div>
      </header>

      <section className="rounded-xl border bg-card p-6">
        <div className="text-lg">
          Overall score: <span className="font-bold text-foreground">{data.totals.totalScore}</span>
          <span className="ml-4 text-sm text-muted-foreground">
            Confidence: {data.totals.confidence}/100
          </span>
        </div>
      </section>

      <div className="space-y-4">
        {data.breakdown.map((block) => (
          <section key={block.component} className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-semibold capitalize text-foreground">{block.component}</h2>
              <div className="text-sm text-muted-foreground">
                <span className="mr-3">
                  Base <span className="font-medium text-foreground">{block.base}</span>
                </span>
                <span className="mr-3">
                  Δ{' '}
                  <span className="font-medium text-foreground">
                    {block.window_delta >= 0 ? `+${block.window_delta}` : block.window_delta}
                  </span>
                </span>
                <span>
                  Now <span className="font-medium text-foreground">{block.value}</span>
                </span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">{block.base_reason}</p>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={block.verified_count > 0 ? 'default' : 'secondary'}>
                {block.verified_count}/{block.evidence_count} verified
              </Badge>
              <Badge variant="outline">Confidence {block.confidence}/100</Badge>
              {block.proof_required && (
                <Badge variant="destructive">Proof required (Δ muted)</Badge>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              {data.evidence[block.component]?.length > 0 ? (
                data.evidence[block.component].map((ev) => (
                  <div key={ev.id} className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium text-foreground">{ev.source_name}</span>
                      {ev.source_date && (
                        <span className="text-muted-foreground">
                          {' '}
                          · {new Date(ev.source_date).toLocaleDateString()}
                        </span>
                      )}
                      <span className="text-muted-foreground"> · </span>
                      {ev.source_url && (
                        <>
                          <a
                            className="underline hover:text-primary"
                            href={ev.source_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Source
                          </a>
                        </>
                      )}
                      {ev.archive_url && (
                        <>
                          <span className="text-muted-foreground"> · </span>
                          <a
                            className="underline hover:text-primary"
                            href={ev.archive_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Archive
                          </a>
                        </>
                      )}
                      <Badge variant="outline" className="ml-2">
                        {ev.verification}
                      </Badge>
                    </div>
                    {ev.snippet && (
                      <blockquote className="text-sm italic text-muted-foreground border-l-2 border-border pl-3">
                        "{ev.snippet}"
                      </blockquote>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No primary sources attached yet.</p>
              )}
            </div>
          </section>
        ))}
      </div>

      <footer className="text-sm text-muted-foreground">
        <Link to={`/brands/${data.brandId}`} className="hover:text-primary">
          ← Back to brand
        </Link>
      </footer>
    </div>
  );
}
