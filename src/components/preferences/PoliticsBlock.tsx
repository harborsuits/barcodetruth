import { Slider } from "@/components/ui/slider";

interface PoliticsBlockProps {
  intensity: number;
  alignment: number;
  onChangeIntensity: (v: number) => void;
  onChangeAlignment: (v: number) => void;
}

export function PoliticsBlock({
  intensity,
  alignment,
  onChangeIntensity,
  onChangeAlignment,
}: PoliticsBlockProps) {
  const alignmentLabel =
    alignment <= 20 ? "Progressive" :
    alignment < 40 ? "Leans Progressive" :
    alignment <= 60 ? "Neutral" :
    alignment < 80 ? "Leans Traditional" :
    "Traditional";

  const intensityLabel =
    intensity <= 20 ? "Prefer apolitical brands" :
    intensity < 40 ? "Low activity preferred" :
    intensity <= 60 ? "No strong preference" :
    intensity < 80 ? "Active is okay" :
    "Prefer very active brands";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 font-medium text-card-foreground">Political Activity Preference</div>
        <div className="text-sm text-muted-foreground mb-4">
          0 = avoid political brands · 100 = prefer brands that take strong public stands
        </div>
        <Slider
          value={[intensity]}
          min={0}
          max={100}
          step={1}
          onValueChange={(v) => onChangeIntensity(v[0])}
        />
        <div className="mt-2 text-sm text-foreground">
          {intensity} — {intensityLabel}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 font-medium text-card-foreground">Political Alignment</div>
        <div className="text-sm text-muted-foreground mb-4">
          0 = progressive · 50 = neutral · 100 = traditional
        </div>
        <Slider
          value={[alignment]}
          min={0}
          max={100}
          step={1}
          onValueChange={(v) => onChangeAlignment(v[0])}
        />
        <div className="mt-2 text-sm text-foreground">
          {alignment} — {alignmentLabel}
        </div>
      </div>
    </div>
  );
}
