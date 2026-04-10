import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sliders, ArrowRight } from "lucide-react";
import { computePersonalizedScore, type UserWeights, type CategoryVector } from "@/lib/personalizedScoring";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  { key: "labor" as const, label: "Labor", emoji: "👷" },
  { key: "environment" as const, label: "Environment", emoji: "🌍" },
  { key: "politics" as const, label: "Politics", emoji: "🏛️" },
  { key: "social" as const, label: "Social", emoji: "🤝" },
];

// Simulated category scores for a demo brand (slightly negative labor/env, neutral others)
const DEMO_CATEGORY_SCORES: CategoryVector = {
  labor: -0.35,
  environment: -0.5,
  politics: 0.1,
  social: 0.2,
};

const DEFAULT_WEIGHT = 0.25;
const BOOSTED_WEIGHT = 0.55;

export function PersonalizationTeaser() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const baseResult = useMemo(() => {
    const equalWeights: UserWeights = { labor: 0.25, environment: 0.25, politics: 0.25, social: 0.25 };
    return computePersonalizedScore(equalWeights, DEMO_CATEGORY_SCORES);
  }, []);

  const personalResult = useMemo(() => {
    if (!activeCategory) return null;
    const weights: UserWeights = {
      labor: DEFAULT_WEIGHT,
      environment: DEFAULT_WEIGHT,
      politics: DEFAULT_WEIGHT,
      social: DEFAULT_WEIGHT,
    };
    // Boost selected category, reduce others proportionally
    weights[activeCategory as keyof UserWeights] = BOOSTED_WEIGHT;
    const remaining = 1 - BOOSTED_WEIGHT;
    const otherKeys = CATEGORIES.filter(c => c.key !== activeCategory).map(c => c.key);
    otherKeys.forEach(k => { weights[k] = remaining / otherKeys.length; });
    return computePersonalizedScore(weights, DEMO_CATEGORY_SCORES);
  }, [activeCategory]);

  const displayScore = personalResult?.personalScore ?? baseResult.personalScore;
  const scoreDiff = personalResult ? personalResult.personalScore - baseResult.personalScore : 0;

  return (
    <section className="space-y-4 bg-elevated-1 border border-border rounded-lg p-5">
      <div className="flex items-center gap-2">
        <Sliders className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Your values, your score</h2>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Two people scan the same product — and see different scores. Tap a value to see how it shifts.
      </p>

      {/* Category toggles */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(({ key, label, emoji }) => (
          <button
            key={key}
            onClick={() => setActiveCategory(activeCategory === key ? null : key)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
              activeCategory === key
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background hover:bg-muted border-border"
            }`}
          >
            {emoji} {label}
          </button>
        ))}
      </div>

      {/* Score display */}
      <div className="flex items-center gap-4 pt-2">
        <div className="text-center">
          <span className="text-3xl font-extrabold tracking-tighter text-foreground">
            {displayScore}
          </span>
          <span className="text-sm text-muted-foreground">/100</span>
        </div>
        {scoreDiff !== 0 && (
          <span className={`text-sm font-semibold ${scoreDiff > 0 ? 'text-success' : 'text-destructive'}`}>
            {scoreDiff > 0 ? '+' : ''}{scoreDiff} pts
          </span>
        )}
        {activeCategory && (
          <span className="text-xs text-muted-foreground">
            with {CATEGORIES.find(c => c.key === activeCategory)?.label} prioritized
          </span>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-primary p-0 h-auto hover:bg-transparent"
        onClick={() => navigate("/settings")}
      >
        Set your values
        <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </Button>
    </section>
  );
}
