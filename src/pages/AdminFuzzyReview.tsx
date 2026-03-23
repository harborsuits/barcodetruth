import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, X, Loader2 } from "lucide-react";

export default function AdminFuzzyReview() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["fuzzy-alias-review", filter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuzzy_alias_review" as any)
        .select("*")
        .eq("status", filter)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("fuzzy_alias_review" as any)
        .update({ status, reviewed_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;

      // If rejected, also remove the auto-created alias
      if (status === "rejected") {
        const row = rows?.find((r: any) => r.id === id);
        if (row) {
          await supabase
            .from("brand_aliases")
            .delete()
            .eq("external_name", row.external_name)
            .eq("source", "openfoodfacts_fuzzy");
        }
      }
    },
    onSuccess: (_, { status }) => {
      toast({ title: status === "approved" ? "Alias approved" : "Alias rejected & removed" });
      qc.invalidateQueries({ queryKey: ["fuzzy-alias-review"] });
    },
  });

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Fuzzy Alias Review</h1>
          <p className="text-sm text-muted-foreground">
            Approve or reject auto-created brand aliases from bulk imports
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filter.charAt(0).toUpperCase() + filter.slice(1)} Aliases
            {rows && <Badge variant="secondary" className="ml-2">{rows.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !rows?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No {filter} aliases</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>External Name</TableHead>
                  <TableHead>Matched Brand</TableHead>
                  <TableHead>Similarity</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Created</TableHead>
                  {filter === "pending" && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.external_name}</TableCell>
                    <TableCell className="text-sm">{r.matched_brand_name || r.matched_brand_id?.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Badge variant={r.similarity_score >= 0.8 ? "default" : "secondary"}>
                        {r.similarity_score != null ? (r.similarity_score * 100).toFixed(0) + "%" : "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.source}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </TableCell>
                    {filter === "pending" && (
                      <TableCell className="text-right space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateStatus.mutate({ id: r.id, status: "approved" })}
                          disabled={updateStatus.isPending}
                        >
                          <Check className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateStatus.mutate({ id: r.id, status: "rejected" })}
                          disabled={updateStatus.isPending}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
