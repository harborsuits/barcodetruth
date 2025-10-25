import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ValueSlidersProps {
  initialValues?: {
    value_labor: number;
    value_environment: number;
    value_politics: number;
    value_social: number;
  };
  onSave: (values: {
    value_labor: number;
    value_environment: number;
    value_politics: number;
    value_social: number;
  }) => void;
  isSaving?: boolean;
}

const SLIDER_CONFIG = [
  {
    key: 'value_labor',
    label: 'Worker Rights & Labor Practices',
    leftLabel: "Don't care",
    rightLabel: "Very important",
    description: "How much do you care about fair wages, working conditions, and union rights?"
  },
  {
    key: 'value_environment',
    label: 'Environmental Impact & Sustainability',
    leftLabel: "Don't care",
    rightLabel: "Very important",
    description: "How much do you care about climate action, pollution, and sustainability efforts?"
  },
  {
    key: 'value_politics',
    label: 'Corporate Lobbying & Political Donations',
    leftLabel: "Don't care",
    rightLabel: "Very important",
    description: "How much do you care about corporate PAC donations and political influence?"
  },
  {
    key: 'value_social',
    label: 'Diversity, Inclusion & Social Values',
    leftLabel: "Traditional values",
    rightLabel: "Progressive values",
    description: "0 = Prefer traditional, avoid DEI/LGBTQ initiatives | 100 = Support diverse, inclusive companies"
  }
];

export function ValueSliders({ initialValues, onSave, isSaving }: ValueSlidersProps) {
  const [values, setValues] = useState({
    value_labor: initialValues?.value_labor ?? 50,
    value_environment: initialValues?.value_environment ?? 50,
    value_politics: initialValues?.value_politics ?? 50,
    value_social: initialValues?.value_social ?? 50,
  });

  useEffect(() => {
    if (initialValues) {
      setValues({
        value_labor: initialValues.value_labor ?? 50,
        value_environment: initialValues.value_environment ?? 50,
        value_politics: initialValues.value_politics ?? 50,
        value_social: initialValues.value_social ?? 50,
      });
    }
  }, [initialValues]);

  const handleSliderChange = (key: string, value: number[]) => {
    setValues(prev => ({ ...prev, [key]: value[0] }));
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

        {SLIDER_CONFIG.map(({ key, label, leftLabel, rightLabel, description }) => (
          <div key={key}>
            <label className="block text-sm font-medium mb-3">
              {label}
            </label>
            <Slider
              value={[values[key as keyof typeof values]]}
              onValueChange={(val) => handleSliderChange(key, val)}
              min={0}
              max={100}
              step={1}
              className="mb-2"
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground mt-2">
              <span>{leftLabel} (0)</span>
              <span className="font-semibold text-lg text-foreground">
                {values[key as keyof typeof values]}
              </span>
              <span>{rightLabel} (100)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {description}
            </p>
          </div>
        ))}

        <Button 
          onClick={() => onSave(values)} 
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
