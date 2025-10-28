import { Badge } from "@/components/ui/badge";
import { getAlignmentLabel, getIntensityLabel } from "@/lib/politicsExplain";
import { FEATURES } from "@/lib/featureFlags";

interface AlignmentBadgeProps {
  alignment: number | null;
  intensity: number | null;
}

export function AlignmentBadge({ alignment, intensity }: AlignmentBadgeProps) {
  if (!FEATURES.POLITICS_TWO_AXIS) {
    return null;
  }

  const alignmentLabel = getAlignmentLabel(alignment);
  const intensityLabel = getIntensityLabel(intensity);
  
  return (
    <Badge variant="outline" className="font-normal">
      {alignmentLabel} · {intensityLabel}
    </Badge>
  );
}
