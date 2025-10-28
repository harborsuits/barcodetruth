// Neutral descriptions for political intensity and alignment

export function describePolitics(
  brandIntensity: number | null,
  brandAlignment: number | null
) {
  const intensity = brandIntensity ?? 50;
  const alignment = brandAlignment ?? 50;

  const intensityText =
    intensity <= 20 ? "low political activity" :
    intensity < 40 ? "limited political activity" :
    intensity <= 60 ? "moderate political activity" :
    intensity < 80 ? "high political activity" :
    "very high political activity";

  const alignText =
    alignment <= 20 ? "leans progressive" :
    alignment < 40 ? "leans somewhat progressive" :
    alignment <= 60 ? "is generally neutral" :
    alignment < 80 ? "leans somewhat traditional" :
    "leans traditional";

  return { intensityText, alignText };
}

export function getAlignmentLabel(alignment: number | null): string {
  const a = alignment ?? 50;
  
  if (a <= 20) return "Progressive";
  if (a < 40) return "Leans Progressive";
  if (a <= 60) return "Neutral";
  if (a < 80) return "Leans Traditional";
  return "Traditional";
}

export function getIntensityLabel(intensity: number | null): string {
  const i = intensity ?? 50;
  
  if (i <= 33) return "Low Activity";
  if (i <= 66) return "Moderate Activity";
  return "High Activity";
}

export function describePoliticsMismatch(
  userIntensity: number,
  userAlignment: number,
  brandIntensity: number | null,
  brandAlignment: number | null
): string | null {
  const bi = brandIntensity ?? 50;
  const ba = brandAlignment ?? 50;
  
  const intensityGap = Math.abs(userIntensity - bi);
  const alignmentGap = Math.abs(userAlignment - ba);
  
  const intensityMismatch = intensityGap > 30;
  const alignmentMismatch = alignmentGap > 30;
  
  if (!intensityMismatch && !alignmentMismatch) return null;
  
  const userPrefersLow = userIntensity < 40;
  const brandIsHigh = bi > 60;
  const userPrefersHigh = userIntensity > 60;
  const brandIsLow = bi < 40;
  
  const userLeansProg = userAlignment < 40;
  const userLeansTraditional = userAlignment > 60;
  const brandLeansProg = ba < 40;
  const brandLeansTraditional = ba > 60;
  
  // Both mismatches
  if (intensityMismatch && alignmentMismatch) {
    const intensityPart = userPrefersLow && brandIsHigh 
      ? "prefer apolitical brands" 
      : userPrefersHigh && brandIsLow
      ? "prefer politically active brands"
      : "";
    
    const alignmentPart = userLeansProg && brandLeansTraditional
      ? "lean progressive"
      : userLeansTraditional && brandLeansProg
      ? "lean traditional"
      : "";
    
    const brandIntensityPart = brandIsHigh ? "high activity" : "low activity";
    const brandAlignmentPart = brandLeansProg 
      ? "leans progressive" 
      : brandLeansTraditional 
      ? "leans traditional"
      : "is neutral";
    
    return `You ${intensityPart} and ${alignmentPart}, but this brand shows ${brandIntensityPart} and ${brandAlignmentPart}.`;
  }
  
  // Only intensity mismatch
  if (intensityMismatch) {
    if (userPrefersLow && brandIsHigh) {
      return "You prefer apolitical brands, but this brand shows high political activity.";
    }
    if (userPrefersHigh && brandIsLow) {
      return "You prefer politically active brands, but this brand shows low political activity.";
    }
  }
  
  // Only alignment mismatch
  if (alignmentMismatch) {
    if (userLeansProg && brandLeansTraditional) {
      return "You lean progressive, but this brand leans traditional.";
    }
    if (userLeansTraditional && brandLeansProg) {
      return "You lean traditional, but this brand leans progressive.";
    }
  }
  
  return null;
}
