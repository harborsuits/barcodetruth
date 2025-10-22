import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const LIVE_SOURCES = [
  { name: "Wikipedia", description: "Brand & company information", type: "reference" },
  { name: "OpenFoodFacts", description: "Product barcode database", type: "data" },
  { name: "Corporate Registries", description: "Ownership & subsidiary data", type: "public" },
  { name: "News APIs", description: "Real-time brand monitoring", type: "news" },
  { name: "Public Records", description: "Executive & shareholder info", type: "public" },
];

const PLANNED_SOURCES = [
  { name: "SEC Filings", description: "Financial disclosures & ownership", type: "government" },
  { name: "LinkedIn", description: "Executive profiles & history", type: "professional" },
  { name: "Crunchbase", description: "Investor & funding data", type: "business" },
];

export function TrustedSources() {
  return (
    <section className="py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Where We Get Our Data</h2>
          <p className="text-muted-foreground">
            Ownership, key people, and brand info from trusted public sources.
          </p>
        </div>

        {/* Live Sources */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Live Sources</h3>
            <Badge variant="default" className="text-xs">Active</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {LIVE_SOURCES.map((source) => (
              <Card key={source.name} className="border-primary/20">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{source.name}</p>
                      <p className="text-xs text-muted-foreground">{source.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Planned Sources */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Planned Integrations</h3>
            <Badge variant="outline" className="text-xs">Coming Soon</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PLANNED_SOURCES.map((source) => (
              <Card key={source.name} className="border-muted">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-muted-foreground">{source.name}</p>
                      <p className="text-xs text-muted-foreground">{source.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
