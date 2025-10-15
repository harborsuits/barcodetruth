import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";

type Evidence = { 
  title: string; 
  url: string; 
  source_name: string | null 
};

type Brand = {
  brand_id: string;
  name: string;
  parent_company: string | null;
  score: number | null;
  score_confidence: number | null;
  last_event_at: string | null;
  verified_rate: number | null;
  independent_sources: number | null;
  events_7d: number | null;
  events_30d: number | null;
  events_365d: number | null;
  ai_summary_md: string | null;
  evidence: Evidence[];
};

export function BrandExplanationCard({ data }: { data: Brand }) {
  const getScoreColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 70) return "text-success";
    if (score >= 40) return "text-warning";
    return "text-danger";
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-2xl mb-2">{data.name}</CardTitle>
            {data.parent_company && (
              <p className="text-sm text-muted-foreground">
                Parent: {data.parent_company}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className={`text-4xl font-bold ${getScoreColor(data.score)}`}>
              {data.score !== null ? Math.round(data.score) : "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {data.score_confidence !== null 
                ? `${Math.round(100 * data.score_confidence)}% confidence`
                : "Score unavailable"
              }
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* AI Summary */}
        {data.ai_summary_md ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div dangerouslySetInnerHTML={{ __html: mdToHtml(data.ai_summary_md) }} />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground text-sm p-4 bg-muted/50 rounded-lg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>No verified events found yet. Score is based on baseline data.</p>
          </div>
        )}

        {/* Sources */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Primary Sources
          </h3>
          {data.evidence && data.evidence.length > 0 ? (
            <ul className="space-y-2">
              {data.evidence.map((e, i) => (
                <li key={i} className="text-sm">
                  <a 
                    href={e.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {e.title || e.url}
                  </a>
                  {e.source_name && (
                    <span className="text-muted-foreground ml-2">
                      — {e.source_name}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No primary sources attached yet
            </p>
          )}
        </div>

        {/* Coverage Stats */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-4 border-t">
          <div className="flex items-center gap-1.5">
            <span className="font-medium">Updated:</span>
            <span>{formatDate(data.last_event_at)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium">Verified:</span>
            <span>
              {data.verified_rate !== null 
                ? `${Math.round(100 * data.verified_rate)}%`
                : "—"
              }
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium">Independent sources:</span>
            <span>{data.independent_sources ?? "—"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium">Events (30d):</span>
            <span>{data.events_30d ?? 0}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Minimal Markdown-to-HTML converter
function mdToHtml(md: string): string {
  const escapeHtml = (s: string) => 
    s.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]!));

  return md
    .split(/\n{2,}/)
    .map(p => {
      const withLinks = p.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, 
        '<a href="$2" target="_blank" rel="noreferrer" class="text-primary hover:underline">$1</a>'
      );
      return `<p>${withLinks}</p>`;
    })
    .join("");
}
