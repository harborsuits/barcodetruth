import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, GitMerge, AlertTriangle } from "lucide-react";

type ClusterBrand = {
  id: string;
  name: string;
  slug: string;
  status: string | null;
  created_at: string;
};

type Cluster = {
  normalized_name: string;
  cluster_size: number;
  brands: ClusterBrand[];
};

export default function AdminBrandMerge() {
  const { toast } = useToast();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);
  const [canonicalChoice, setCanonicalChoice] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { data, error } = await client
      .from("v_brand_duplicate_clusters")
      .select("*")
      .order("cluster_size", { ascending: false })
      .limit(100);

    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    } else {
      setClusters((data as Cluster[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const mergeOne = async (_clusterKey: string, canonicalId: string, duplicateId: string) => {
    setMerging(`${canonicalId}->${duplicateId}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { data, error } = await client.rpc("merge_brands", {
      p_canonical_id: canonicalId,
      p_duplicate_id: duplicateId,
    });
    setMerging(null);

    if (error) {
      toast({ title: "Merge failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Merged",
      description: `Reassigned ${
        Object.keys((data as { reassigned?: Record<string, number> })?.reassigned || {}).length
      } reference table(s).`,
    });
    load();
  };

  const mergeAllInCluster = async (cluster: Cluster) => {
    const canonicalId = canonicalChoice[cluster.normalized_name] || cluster.brands[0].id;
    const duplicates = cluster.brands.filter((b) => b.id !== canonicalId);
    for (const dup of duplicates) {
      await mergeOne(cluster.normalized_name, canonicalId, dup.id);
    }
  };

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Brand Merge Tool</h1>
        <p className="text-muted-foreground mt-1">
          Duplicate clusters detected by <code>normalized_name</code>. Pick the canonical row and
          merge the rest into it. All product, event, score, and follow references are reassigned
          atomically.
        </p>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/5 text-sm">
        <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
        <span>
          Merges are <strong>not reversible</strong>. Verify the brands are truly the same entity
          (e.g. "Apple" vs "Apple Bank" should NOT be merged).
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${clusters.length} cluster(s)`}
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : clusters.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            🎉 No duplicate clusters found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {clusters.map((cluster) => {
            const canonicalId =
              canonicalChoice[cluster.normalized_name] || cluster.brands[0].id;
            return (
              <Card key={cluster.normalized_name}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>
                      <code className="text-primary">{cluster.normalized_name || "(empty)"}</code>{" "}
                      <Badge variant="secondary" className="ml-2">
                        {cluster.cluster_size} brands
                      </Badge>
                    </span>
                    <Button
                      size="sm"
                      onClick={() => mergeAllInCluster(cluster)}
                      disabled={!!merging || !cluster.normalized_name}
                    >
                      <GitMerge className="h-4 w-4 mr-1" />
                      Merge all into selected
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cluster.brands.map((b) => {
                    const isCanonical = b.id === canonicalId;
                    return (
                      <div
                        key={b.id}
                        className={`flex items-center justify-between p-3 rounded-md border ${
                          isCanonical
                            ? "border-primary/50 bg-primary/5"
                            : "border-border bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="radio"
                            name={`canonical-${cluster.normalized_name}`}
                            checked={isCanonical}
                            onChange={() =>
                              setCanonicalChoice((prev) => ({
                                ...prev,
                                [cluster.normalized_name]: b.id,
                              }))
                            }
                          />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{b.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {b.slug} · {b.status || "?"} ·{" "}
                              {new Date(b.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        {isCanonical ? (
                          <Badge variant="default">Canonical</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => mergeOne(cluster.normalized_name, canonicalId, b.id)}
                            disabled={merging === `${canonicalId}->${b.id}`}
                          >
                            {merging === `${canonicalId}->${b.id}` ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Merge into canonical"
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
