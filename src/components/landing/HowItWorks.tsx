import { Heart, Scale, Sparkles, ArrowRight, AlertTriangle } from "lucide-react";

export function HowItWorks() {
  return (
    <section className="py-16 px-4">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold">Your Values, Visualized</h2>
          <p className="text-base text-muted-foreground max-w-xl mx-auto">
            We match brands to what matters most to you
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="group text-center space-y-3 p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/20 transition-all hover:scale-[1.02]">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
              <Heart className="h-7 w-7" />
            </div>
            <div>
              <div className="font-semibold text-lg mb-1">Choose what matters to you</div>
              <div className="text-sm text-muted-foreground">
                Set preferences across Labor, Environment, Politics, and Social Issues
              </div>
            </div>
          </div>

          <div className="group text-center space-y-3 p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/20 transition-all hover:scale-[1.02]">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 text-accent group-hover:bg-accent/20 transition-colors">
              <Scale className="h-7 w-7" />
            </div>
            <div>
              <div className="font-semibold text-lg mb-1">We find brands that share your priorities</div>
              <div className="text-sm text-muted-foreground">
                Real scores from verified news, not marketing claims
              </div>
            </div>
          </div>

          <div className="group text-center space-y-3 p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/20 transition-all hover:scale-[1.02]">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-success/10 text-success group-hover:bg-success/20 transition-colors">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <div className="font-semibold text-lg mb-1">See alignment, skip greenwashing</div>
              <div className="text-sm text-muted-foreground">
                Read evidence, compare scores, find better alternatives
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Example */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card to-muted/20 border border-border p-8 shadow-lg">
          <div className="space-y-6">
            {/* Example Label */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/20">
              <span className="text-xs font-semibold text-warning uppercase tracking-wide">Example</span>
            </div>

            {/* Comparison */}
            <div className="grid md:grid-cols-[1fr,auto,1fr] gap-6 items-center">
              <div className="space-y-2 p-5 rounded-2xl bg-card border border-border/50">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">You care about</div>
                <div className="text-2xl font-bold">Labor: 90</div>
                <div className="text-sm text-muted-foreground">Deeply care about worker rights</div>
              </div>

              <ArrowRight className="h-6 w-6 text-muted-foreground hidden md:block" />

              <div className="space-y-2 p-5 rounded-2xl bg-card border border-destructive/30">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Brand X has</div>
                <div className="text-2xl font-bold text-destructive">Labor: 35</div>
                <div className="text-sm text-muted-foreground">Multiple labor violations</div>
              </div>
            </div>

            {/* Match Result */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-destructive/10 to-destructive/5 border-2 border-destructive/30 p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <AlertTriangle className="h-6 w-6 text-destructive animate-pulse" />
                  <span className="text-4xl font-bold text-destructive">45% Match</span>
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-destructive">
                    <span>Major Mismatch</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    This brand's record conflicts with your priorities. Try these brands with stronger labor practices instead.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Why It Matters */}
        <div className="max-w-2xl mx-auto space-y-6 text-center">
          <h3 className="text-xl font-semibold">Why This Matters</h3>
          <div className="space-y-4 text-left">
            <div className="p-4 rounded-xl bg-card border border-border/50">
              <p className="text-sm leading-relaxed">
                <span className="font-semibold text-primary">Every purchase is a vote.</span> But most brands hide behind vague promises like "eco-friendly" or "we care." We cut through the marketing by tracking real news—labor disputes, environmental fines, political donations, community impact—and turning it into scores you can actually use.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/50">
              <p className="text-sm leading-relaxed">
                <span className="font-semibold text-primary">Your match % shows alignment.</span> If you care deeply about worker rights (say, 90/100) but a brand scores 35 on labor, that's a huge gap. We'll show you alternatives that score 80+ instead—brands that actually match what you stand for.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/50">
              <p className="text-sm leading-relaxed">
                <span className="font-semibold text-primary">No greenwashing, no guessing.</span> All scores link back to verified sources—news articles, government records, court filings. You see exactly why a brand scored the way it did, so you can make informed choices that feel good.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
