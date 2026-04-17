import { Link } from "react-router-dom";
import { ShieldCheck, FileSearch, RefreshCw, Flag } from "lucide-react";

const PILLARS = [
  {
    icon: ShieldCheck,
    title: "Independent",
    body: "We don't take payment from brands. No ads. No sponsored scores.",
  },
  {
    icon: FileSearch,
    title: "Transparent",
    body: "Every claim cites a source you can inspect. No hidden weighting.",
  },
  {
    icon: RefreshCw,
    title: "Fresh",
    body: "Scores update daily as new regulatory filings, news, and lawsuits surface.",
  },
  {
    icon: Flag,
    title: "Correctable",
    body: "Disagree with a verdict? Flag it. We review every report.",
  },
];

export function TrustStrip() {
  return (
    <section className="py-10">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[3px] text-muted-foreground font-medium mb-2">
            Why trust us
          </p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-foreground">
            Receipts, not vibes.
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="bg-card border border-border rounded-lg p-4 space-y-2">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">{p.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.body}</p>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center gap-4 pt-6 text-sm">
          <Link to="/how-scores-work" className="text-primary hover:underline">How scores work</Link>
          <span className="text-muted-foreground/40">·</span>
          <Link to="/why-trust-us" className="text-primary hover:underline">Why trust us</Link>
        </div>
      </div>
    </section>
  );
}
