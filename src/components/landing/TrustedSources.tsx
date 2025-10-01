import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

const SOURCES = [
  { name: "Reuters", type: "news" },
  { name: "Associated Press", type: "news" },
  { name: "EPA", type: "government" },
  { name: "FEC", type: "government" },
  { name: "OSHA", type: "government" },
  { name: "ILO", type: "international" },
  { name: "Bloomberg", type: "news" },
  { name: "SEC", type: "government" },
];

export function TrustedSources() {
  return (
    <section className="py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Trusted Sources</h2>
          <p className="text-muted-foreground">
            Our events are aggregated from credible news outlets, government agencies, and international organizations.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SOURCES.map((source) => (
            <Card key={source.name} className="border-primary/20">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{source.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{source.type}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
