import { EventCard, type BrandEvent } from './EventCard';

interface NuanceSectionProps {
  events: BrandEvent[];
}

export default function NuanceSection({ events }: NuanceSectionProps) {
  const positives = events.filter(e => e.orientation === 'positive');
  const negatives = events.filter(e => e.orientation === 'negative');
  const mixed = events.filter(e => e.orientation === 'mixed' || !e.orientation);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="text-success">✓</span> Positive Signals
        </h3>
        {positives.length ? (
          <div className="space-y-3">
            {positives.map(e => <EventCard key={e.event_id} event={e} showFullDetails />)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg">
            No positive signals yet.
          </p>
        )}
      </div>
      
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="text-danger">✗</span> Negative Signals
        </h3>
        {negatives.length ? (
          <div className="space-y-3">
            {negatives.map(e => <EventCard key={e.event_id} event={e} showFullDetails />)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg">
            No negative signals yet.
          </p>
        )}
      </div>
      
      {!!mixed.length && (
        <div className="md:col-span-2">
          <details className="rounded-lg border p-4 group hover:bg-muted/20 transition-colors">
            <summary className="cursor-pointer text-sm font-medium flex items-center gap-2">
              <span className="group-open:rotate-90 transition-transform">▸</span>
              Context & Mixed Signals ({mixed.length})
            </summary>
            <div className="mt-3 grid gap-3">
              {mixed.map(e => <EventCard key={e.event_id} event={e} compact />)}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
