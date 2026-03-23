import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface OwnershipConflict {
  conflict_type: string;
  child_brand_id: string;
  brand_name: string | null;
  detail: string;
  confidence: number | null;
}

const CONFLICT_CONFIG: Record<string, { label: string; icon: typeof AlertTriangle; variant: "destructive" | "default" | "secondary" }> = {
  investor_as_operating_parent: { label: "Investor as Parent", icon: AlertTriangle, variant: "destructive" },
  multiple_current_parents: { label: "Multiple Parents", icon: Users, variant: "destructive" },
  low_confidence_parent: { label: "Low Confidence", icon: Shield, variant: "secondary" },
};

export default function AdminOwnershipAudit() {
  const navigate = useNavigate();

  const { data: conflicts = [], isLoading } = useQuery({
    queryKey: ["ownership-conflicts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_ownership_conflicts" as any)
        .select("*");
      if (error) throw error;
      return (data || []) as unknown as OwnershipConflict[];
    },
  });

  const grouped = conflicts.reduce<Record<string, OwnershipConflict[]>>((acc, c) => {
    (acc[c.conflict_type] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Ownership Conflict Audit</h1>
        <Badge variant="outline">{conflicts.length} issues</Badge>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading conflicts...</p>
      ) : conflicts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>No ownership conflicts detected. Graph integrity looks good.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([type, items]) => {
          const config = CONFLICT_CONFIG[type] || { label: type, icon: AlertTriangle, variant: "default" as const };
          const Icon = config.icon;

          return (
            <Card key={type}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4" />
                  {config.label}
                  <Badge variant={config.variant}>{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => navigate(`/brand/${item.child_brand_id}`)}
                    >
                      <div>
                        <p className="font-medium text-sm">{item.brand_name || "Unknown brand"}</p>
                        <p className="text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                      {item.confidence != null && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(item.confidence * 100)}% conf
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
