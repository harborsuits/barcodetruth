import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface ShareCardProps {
  brandName: string;
  score: number | null;
  verdict: string;
  dimensions: { label: string; grade: string }[];
}

function getGrade(score: number | null): string {
  if (score === null) return "—";
  if (score >= 85) return "A";
  if (score >= 75) return "B+";
  if (score >= 65) return "B";
  if (score >= 55) return "B-";
  if (score >= 45) return "C";
  if (score >= 35) return "C-";
  if (score >= 25) return "D";
  return "F";
}

export function ShareCard({ brandName, score, verdict, dimensions }: ShareCardProps) {
  const handleShare = async () => {
    const grades = dimensions.map((d) => `${d.label}: ${d.grade}`).join("\n");
    const text = `${brandName} — Trust Score: ${score !== null ? Math.round(score) : "?"}/100\nVerdict: ${verdict}\n\n${grades}\n\nChecked with Barcode Truth`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `${brandName} — Barcode Truth`, text });
        return;
      } catch {}
    }

    await navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard", description: "Share this result with friends" });
  };

  return (
    <Button
      variant="outline"
      className="w-full font-mono text-[10px] uppercase tracking-widest"
      onClick={handleShare}
    >
      <Share2 className="h-3.5 w-3.5 mr-2" />
      Share This Result
    </Button>
  );
}

export { getGrade };
