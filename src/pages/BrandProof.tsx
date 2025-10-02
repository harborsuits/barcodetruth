import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Download, Home, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { BrandProofResponse } from '@/types/evidence';

export default function BrandProof() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<BrandProofResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllByComponent, setShowAllByComponent] = useState<Record<string, boolean>>({});

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

  const handleExportCSV = () => {
    if (!data) return;
    
    const esc = (s: any) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const rows = [['Brand', 'Component', 'Source', 'Date', 'Verification', 'URL', 'Archive']];
    data.breakdown.forEach((block) => {
      (data.evidence[block.component] || []).forEach((ev) => {
        rows.push([
          data.brandName,
          block.component,
          ev.source_name,
          ev.source_date || '',
          ev.verification,
          ev.source_url || '',
          ev.archive_url || '',
        ]);
      });
    });
    
    const csv = rows.map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.brandName}-evidence.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getVerificationColor = (verification: string) => {
    switch (verification) {
      case 'official': return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200';
      case 'corroborated': return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getVerificationOrder = (verification: string) => {
    switch (verification) {
      case 'official': return 0;
      case 'corroborated': return 1;
      default: return 2;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString(undefined, { timeZone: 'UTC', dateStyle: 'short' });
  };

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
    <>
      <Helmet>
        <title>{data.brandName} · Evidence & Sources</title>
        <meta 
          name="description" 
          content={`See the articles and public records behind ${data.brandName}'s score — with archives and verification status.`} 
        />
        <link rel="canonical" href={`${window.location.origin}/brands/${data.brandId}/proof`} />
      </Helmet>
      
      <TooltipProvider>
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <Link to="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Home className="h-3.5 w-3.5" />
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link to={`/brands/${data.brandId}`} className="hover:text-foreground transition-colors">
              {data.brandName}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">Evidence</span>
          </nav>
          
          <header className="flex items-baseline justify-between flex-wrap gap-4">
            <h1 className="text-2xl font-semibold text-foreground">{data.brandName} · Evidence</h1>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportCSV}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <div className="text-sm text-muted-foreground">
                Updated {new Date(data.updatedAt).toLocaleString(undefined, { timeZone: 'UTC' })}
              </div>
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
              <section 
                key={block.component} 
                id={`proof-${block.component}`}
                className="rounded-xl border bg-card p-6 space-y-4 scroll-mt-6"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="font-semibold capitalize text-foreground">
                    <a href={`#proof-${block.component}`} className="hover:underline">
                      {block.component}
                    </a>
                  </h2>
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

                <p className="text-sm text-muted-foreground">
                  {block.base_reason || 'Baseline from historical data'}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant={block.verified_count > 0 ? 'default' : 'secondary'}>
                        {block.verified_count}/{block.evidence_count} verified
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Verified = official records or allow-listed outlets</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant={block.independent_owners >= 2 ? "default" : "secondary"}>
                        {block.independent_owners} independent {block.independent_owners === 1 ? 'outlet' : 'outlets'}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Distinct ownership groups; large deltas require ≥2 independent sources</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Badge variant="outline">Confidence {block.confidence}/100</Badge>
                  
                  {block.proof_required && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="destructive">Proof required</Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Change detected but awaiting independent confirmation. Delta is muted until verified.</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {block.syndicated_hidden_count > 0 && (
                    <button
                      className="text-xs underline ml-2 hover:opacity-70 transition-opacity"
                      onClick={() => setShowAllByComponent(prev => ({
                        ...prev,
                        [block.component]: !prev[block.component]
                      }))}
                    >
                      {showAllByComponent[block.component] 
                        ? 'Hide syndicated copies' 
                        : `Show syndicated copies (${block.syndicated_hidden_count} hidden)`}
                    </button>
                  )}
                </div>

            <Separator />

                <div className="space-y-3">
                  {(() => {
                    const evidenceList = showAllByComponent[block.component] 
                      ? data.evidence_full[block.component] 
                      : data.evidence[block.component];
                    
                    return evidenceList?.length > 0 ? (
                      [...evidenceList]
                        .sort((a, b) => getVerificationOrder(a.verification) - getVerificationOrder(b.verification))
                        .map((ev) => (
                      <div key={ev.id} className="space-y-2">
                        <div className="text-sm flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{ev.source_name}</span>
                          {ev.domain_owner && ev.domain_owner !== 'Unknown' && (
                            <span className="text-xs text-muted-foreground">({ev.domain_owner})</span>
                          )}
                          {ev.source_date && (
                            <span className="text-muted-foreground">
                              · {formatDate(ev.source_date)}
                            </span>
                          )}
                          <span className="text-muted-foreground">·</span>
                          <span 
                            className={`text-xs font-medium px-1.5 py-0.5 rounded ${getVerificationColor(ev.verification)}`}
                          >
                            {ev.verification}
                          </span>
                          {ev.source_url && (
                            <>
                              <span className="text-muted-foreground">·</span>
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
                              <span className="text-muted-foreground">·</span>
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
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getVerificationColor(ev.verification)}`}>
                            {ev.verification}
                          </span>
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
                    );
                  })()}
                </div>
          </section>
        ))}
      </div>

          <footer className="text-sm text-muted-foreground border-t pt-4">
            <Link to={`/brands/${data.brandId}`} className="hover:text-primary inline-flex items-center gap-1">
              ← Back to {data.brandName}
            </Link>
            <p className="text-xs mt-2">
              We deduplicate syndicated articles and require independent owners for big moves. Wires alone don't count unless paired with official records.
            </p>
          </footer>
        </div>
      </TooltipProvider>
    </>
  );
}
