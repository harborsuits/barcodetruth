import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Play, Database, FileText, Calculator, RefreshCw, ArrowLeft } from "lucide-react";

export const AdminTriggers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const trigger = async (action: string, label: string) => {
    setLoading(action);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("trigger-enrichment", {
        body: { action },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `${label} triggered successfully`,
      });
    } catch (error: any) {
      console.error("Trigger error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const triggerReclassification = async () => {
    setLoading('reclassify');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      toast({ title: 'Starting reclassification...', description: 'This may take a few minutes' });
      
      const { data, error } = await supabase.functions.invoke('reclassify-events');
      
      if (error) throw error;

      toast({ 
        title: 'Reclassification complete', 
        description: `Updated ${data?.results?.updated_count || 0} events`
      });
    } catch (error: any) {
      console.error("Reclassification error:", error);
      toast({ 
        title: 'Reclassification failed', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setLoading(null);
    }
  };

  const triggers = [
    {
      action: "ingest-all",
      label: "Ingest All Sources",
      description: "Pull latest data from FDA, EPA, OSHA, and FEC",
      icon: Database,
    },
    {
      action: "calculate-scores",
      label: "Calculate Scores",
      description: "Recalculate brand scores based on latest events",
      icon: Calculator,
    },
    {
      action: "enrich-brands",
      label: "Enrich Brands",
      description: "Fetch Wikipedia descriptions for brands",
      icon: FileText,
    },
    {
      action: "generate-summaries",
      label: "Generate Summaries",
      description: "Create AI summaries for recent events",
      icon: RefreshCw,
    },
  ];

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Admin Triggers</h1>
          <p className="text-muted-foreground mt-2">
            Manually trigger enrichment and ingestion jobs
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {triggers.map((t) => {
          const Icon = t.icon;
          const isLoading = loading === t.action;

          return (
            <Card key={t.action}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {t.label}
                </CardTitle>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => trigger(t.action, t.label)}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Trigger
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
        
        {/* Reclassification Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Reclassify Events
            </CardTitle>
            <CardDescription>
              Re-categorize recent events using updated taxonomy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={triggerReclassification}
              disabled={loading === 'reclassify'}
              className="w-full"
            >
              {loading === 'reclassify' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reclassifying...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Trigger
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
