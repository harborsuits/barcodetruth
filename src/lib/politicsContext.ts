export interface PoliticalGiving {
  dem_percent: number;
  rep_percent: number;
}

export type PoliticalAlignment = "progressive" | "conservative" | "moderate" | "neutral" | null;

export function getPoliticalContext(
  giving: PoliticalGiving,
  alignment: PoliticalAlignment
): { message: string | null; alignmentMatch: "aligned" | "misaligned" | "neutral" } {
  if (!alignment || alignment === "neutral") {
    return { message: null, alignmentMatch: "neutral" };
  }

  const { dem_percent, rep_percent } = giving;
  const diff = Math.abs(dem_percent - rep_percent);

  // Not significant enough to comment on
  if (diff < 15) {
    return { 
      message: "Giving is relatively balanced between parties.", 
      alignmentMatch: "neutral" 
    };
  }

  const leansDem = dem_percent > rep_percent;
  const leansRep = rep_percent > dem_percent;

  switch (alignment) {
    case "progressive":
      if (leansDem) {
        return {
          message: `This brand's giving leans Democratic (${dem_percent}% vs ${rep_percent}%), which may align with progressive values.`,
          alignmentMatch: "aligned",
        };
      } else {
        return {
          message: `This brand's giving leans Republican (${rep_percent}% vs ${dem_percent}%), which may not align with progressive values.`,
          alignmentMatch: "misaligned",
        };
      }

    case "conservative":
      if (leansRep) {
        return {
          message: `This brand's giving leans Republican (${rep_percent}% vs ${dem_percent}%), which may align with conservative values.`,
          alignmentMatch: "aligned",
        };
      } else {
        return {
          message: `This brand's giving leans Democratic (${dem_percent}% vs ${rep_percent}%), which may not align with conservative values.`,
          alignmentMatch: "misaligned",
        };
      }

    case "moderate":
      if (diff > 40) {
        return {
          message: `This brand's giving strongly favors one party (${Math.max(dem_percent, rep_percent)}%), which may not align with moderate preferences.`,
          alignmentMatch: "misaligned",
        };
      } else {
        return {
          message: `This brand's giving shows ${leansDem ? 'Democratic' : 'Republican'} preference (${Math.max(dem_percent, rep_percent)}% vs ${Math.min(dem_percent, rep_percent)}%), with some balance.`,
          alignmentMatch: "neutral",
        };
      }

    default:
      return { message: null, alignmentMatch: "neutral" };
  }
}

export function getAlignmentBadgeColor(match: "aligned" | "misaligned" | "neutral"): string {
  switch (match) {
    case "aligned":
      return "bg-success/10 text-success border-success/20";
    case "misaligned":
      return "bg-danger/10 text-danger border-danger/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
