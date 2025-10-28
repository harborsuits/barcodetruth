import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PoliticsBlock } from "@/components/preferences/PoliticsBlock";
import { FEATURES } from "@/lib/featureFlags";
import { analytics } from "@/lib/analytics";

interface ValueSlidersProps {
  initialValues?: {
    value_labor: number;
    value_environment: number;
    value_politics: number;
    value_social: number;
    value_political_intensity?: number;
    value_political_alignment?: number;
  };
  onSave: (values: {
    value_labor: number;
    value_environment: number;
    value_politics: number;
    value_social: number;
    value_political_intensity?: number;
    value_political_alignment?: number;
  }) => void;
  isSaving?: boolean;
}

const SLIDER_CONFIG = [
  {
    key: 'value_labor',
    label: 'Worker Rights & Labor Practices',
    leftLabel: "Don't prioritize (0)",
    rightLabel: "Very important (100)",
    description: "How much do you care about how companies treat their workers, pay wages, and handle unions?",
    examples: {
      low: "I don't factor labor practices into buying decisions",
      high: "I actively avoid companies with poor labor records and support union-friendly businesses"
    }
  },
  {
    key: 'value_environment',
    label: 'Environmental Impact & Sustainability',
    leftLabel: "Don't prioritize (0)",
    rightLabel: "Very important (100)",
    description: "How much do you care about climate change, pollution, and sustainable practices?",
    examples: {
      low: "Environmental impact doesn't affect my shopping choices",
      high: "I prioritize eco-friendly companies and avoid polluters"
    }
  },
  {
    key: 'value_social',
    label: 'Diversity, Inclusion & Social Values',
    leftLabel: "Traditional values (0)",
    rightLabel: "Progressive values (100)",
    description: "Where do you stand on DEI programs, LGBTQ+ support, and social justice initiatives?",
    examples: {
      low: "I prefer traditional companies without DEI/LGBTQ programs",
      high: "I support diverse, inclusive companies with strong DEI initiatives"
    }
  }
];

export function ValueSliders({ initialValues, onSave, isSaving }: ValueSlidersProps) {
  const [values, setValues] = useState({
    value_labor: initialValues?.value_labor ?? 50,
    value_environment: initialValues?.value_environment ?? 50,
    value_politics: initialValues?.value_politics ?? 50,
    value_social: initialValues?.value_social ?? 50,
    value_political_intensity: initialValues?.value_political_intensity ?? 50,
    value_political_alignment: initialValues?.value_political_alignment ?? 50,
  });

  useEffect(() => {
    if (initialValues) {
      setValues({
        value_labor: initialValues.value_labor ?? 50,
        value_environment: initialValues.value_environment ?? 50,
        value_politics: initialValues.value_politics ?? 50,
        value_social: initialValues.value_social ?? 50,
        value_political_intensity: initialValues.value_political_intensity ?? 50,
        value_political_alignment: initialValues.value_political_alignment ?? 50,
      });
    }
  }, [initialValues]);

  const handleSliderChange = (key: string, value: number[]) => {
    setValues(prev => ({ ...prev, [key]: value[0] }));
  };

  const handleSave = () => {
    // Track political preference changes
    if (FEATURES.POLITICS_TWO_AXIS) {
      if (initialValues?.value_political_intensity !== values.value_political_intensity) {
        analytics.trackPoliticalIntensityChanged(
          initialValues?.value_political_intensity ?? 50,
          values.value_political_intensity
        );
      }
      if (initialValues?.value_political_alignment !== values.value_political_alignment) {
        analytics.trackPoliticalAlignmentChanged(
          initialValues?.value_political_alignment ?? 50,
          values.value_political_alignment
        );
      }
    }
    onSave(values);
  };

  return (
    <Card className="p-6">
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-semibold mb-2">What matters to you when shopping?</h3>
          <p className="text-sm text-muted-foreground">
            Drag sliders to set your values (0-100). We'll show you which companies match your priorities.
          </p>
        </div>

        {SLIDER_CONFIG.map(({ key, label, leftLabel, rightLabel, description, examples }) => (
          <div key={key} className="border rounded-lg p-4 bg-card">
            <label className="block text-base font-semibold mb-2">
              {label}
            </label>
            <p className="text-sm text-muted-foreground mb-4">{description}</p>
            
            <Slider
              value={[values[key as keyof typeof values]]}
              onValueChange={(val) => handleSliderChange(key, val)}
              min={0}
              max={100}
              step={1}
              className="mb-3"
            />
            
            <div className="text-center mb-3">
              <span className="text-3xl font-bold text-primary">
                {values[key as keyof typeof values]}
              </span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            
            <div className="flex justify-between text-xs text-muted-foreground mb-4">
              <span>{leftLabel}</span>
              <span>{rightLabel}</span>
            </div>
            
            <div className="bg-muted/50 rounded-md p-3 text-xs space-y-2">
              <div>
                <span className="font-medium">0-30:</span> {examples.low}
              </div>
              <div>
                <span className="font-medium">70-100:</span> {examples.high}
              </div>
            </div>
          </div>
        ))}

        {FEATURES.POLITICS_TWO_AXIS && (
          <div>
            <h4 className="text-lg font-semibold mb-4">Political Activity & Alignment</h4>
            <PoliticsBlock
              intensity={values.value_political_intensity}
              alignment={values.value_political_alignment}
              onChangeIntensity={(v) => setValues(prev => ({ ...prev, value_political_intensity: v }))}
              onChangeAlignment={(v) => setValues(prev => ({ ...prev, value_political_alignment: v }))}
            />
          </div>
        )}

        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="w-full"
          size="lg"
        >
          {isSaving ? 'Saving...' : 'Save My Values'}
        </Button>
      </div>
    </Card>
  );
}
