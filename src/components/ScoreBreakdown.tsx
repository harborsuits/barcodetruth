import { Link } from "react-router-dom";

type Cat = 'labor' | 'environment' | 'politics' | 'social';
type Breakdown = {
  component: Cat;
  base: number;
  base_reason: string;
  window_delta: number;
  value: number;
  confidence: number;
  verified_count: number;
  independent_owners: number;
  proof_required: boolean;
};

export default function ScoreBreakdown({
  brandId,
  blocks,
}: { brandId: string; blocks: Breakdown[] }) {
  return (
    <section className="rounded-2xl border p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Score transparency</h3>
        <Link
          to={`/brands/${brandId}/proof`}
          className="text-sm underline underline-offset-2"
        >
          View all evidence →
        </Link>
      </header>

      {blocks.map((b) => {
        const now = b.value;
        const delta = Math.round(b.window_delta);
        const deltaStr = delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}`;
        const why = buildWhyLine(b, delta);
        return (
          <div key={b.component} className="rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <div className="font-medium capitalize">{b.component}</div>
              <div className="text-sm text-muted-foreground">
                Confidence <span className="font-medium">{b.confidence}</span>/100
              </div>
            </div>

            {/* base → delta → now */}
            <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground" title="24-month baseline from EPA, OSHA, FEC, and news sentiment (deduped)">Base</div>
                <div className="font-medium">{b.base}</div>
                <div className="text-xs text-muted-foreground line-clamp-1" title={b.base_reason}>
                  {b.base_reason}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground" title="Net impact from recent verified events; large moves need independent confirmation">Δ window</div>
                <div className={`font-medium ${delta < 0 ? 'text-destructive' : delta === 0 ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {deltaStr}
                </div>
                <div className="text-xs text-muted-foreground">
                  {b.verified_count} verified · {b.independent_owners} owners
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Now</div>
                <div className="font-semibold">{now}</div>
                {b.proof_required && delta !== 0 && (
                  <div className="text-xs text-amber-700" title="Change detected, awaiting independent confirmation (≥2 owners or 1 official record). Delta is muted until verified.">
                    Proof required
                  </div>
                )}
              </div>
            </div>

            {/* confidence bar */}
            <div className="mt-3 h-1.5 rounded bg-muted">
              <div
                className={`h-1.5 rounded transition-all ${b.confidence < 30 ? 'bg-amber-500' : 'bg-primary'}`}
                style={{ width: `${Math.max(4, Math.min(100, b.confidence))}%` }}
                aria-label={`Confidence ${b.confidence} of 100`}
              />
            </div>

            {/* why line */}
            <p className="mt-3 text-sm text-muted-foreground">{why}</p>
          </div>
        );
      })}
    </section>
  );
}

function buildWhyLine(b: Breakdown, delta: number) {
  if (delta === 0) {
    return 'No material change in the current window.';
  }
  const dir = delta > 0 ? 'above' : 'below';
  const pts = Math.abs(delta);
  const proof = b.proof_required ? ' Change muted until independently verified.' : '';
  return `${capitalize(b.component)} ${b.value}: ${dir} baseline by ${pts}${pts ? ' pts' : ''} in the recent window based on ${b.verified_count} verified source${
    b.verified_count === 1 ? '' : 's'
  } across ${b.independent_owners} independent owner${
    b.independent_owners === 1 ? '' : 's'
  }.${proof}`;
}

const capitalize = (s: string) => s.slice(0, 1).toUpperCase() + s.slice(1);
