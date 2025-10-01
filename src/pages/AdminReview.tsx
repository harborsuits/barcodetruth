import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, AlertCircle, CheckCircle2, Settings } from "lucide-react";
import { SourceCredibilityManager } from "@/components/admin/SourceCredibilityManager";

export function AdminReview() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [newSourceUrl, setNewSourceUrl] = useState("");

  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ['admin-review-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_events_needing_review' as any)
        .select('*')
        .order('event_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: health } = useQuery({
    queryKey: ['ops-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_ops_health' as any)
        .select('*')
        .maybeSingle();
      
      if (error) {
        console.error('Health check error:', error);
        return null;
      }
      return data as unknown as {
        events_total: number;
        unverified_total: number;
        jobs_pending: number;
        jobs_dead: number;
        scores_stale_7d: number;
      } | null;
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const handleAttachSource = async (eventId: string) => {
    if (!newSourceUrl.trim()) {
      toast({
        title: 'Invalid input',
        description: 'Please enter a source URL',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('event_sources')
        .insert({
          event_id: eventId,
          source_name: new URL(newSourceUrl).hostname,
          source_url: newSourceUrl,
          published_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Queue verification job
      await supabase.functions.invoke('verify-event', {
        body: { event_id: eventId },
      });

      toast({
        title: 'Source attached',
        description: 'Verification job queued',
      });

      setNewSourceUrl('');
      setSelectedEvent(null);
      refetch();
    } catch (error) {
      console.error('Error attaching source:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to attach source',
        variant: 'destructive',
      });
    }
  };

  const handleEscalateVerification = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('brand_events')
        .update({ verification: 'corroborated' })
        .eq('event_id', eventId);

      if (error) throw error;

      toast({
        title: 'Verification escalated',
        description: 'Event marked as corroborated',
      });

      refetch();
    } catch (error) {
      console.error('Error escalating:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to escalate',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading admin review...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold">Admin Review</h1>
            </div>
            <Badge variant="outline">{events?.length || 0} pending</Badge>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Tabs defaultValue="review" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="review">Events Review</TabsTrigger>
            <TabsTrigger value="health">System Health</TabsTrigger>
            <TabsTrigger value="sources">
              <Settings className="h-4 w-4 mr-2" />
              Sources
            </TabsTrigger>
          </TabsList>

          <TabsContent value="health" className="space-y-6">
            {health && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{health.events_total}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Unverified</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">
                      {health.unverified_total}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Jobs Pending</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{health.jobs_pending}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Jobs Dead</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {health.jobs_dead}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Stale Scores (7d)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{health.scores_stale_7d}</div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="sources">
            <SourceCredibilityManager />
          </TabsContent>

          <TabsContent value="review" className="space-y-6">
            {!events || events.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No events requiring review</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              events.map((event: any) => (
                <Card key={event.event_id} className="border-l-4 border-l-warning">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{event.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-2">
                          {event.description}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Badge variant="outline" className="capitalize">
                          {event.category}
                        </Badge>
                        <Badge variant="secondary">
                          {event.verification}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        <span>Impact: {event.max_abs_impact}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Credibility: {(event.credibility_avg * 100).toFixed(0)}%</span>
                      </div>
                      <div>
                        Brand: <strong>{event.brand_id}</strong>
                      </div>
                      <div>
                        Date: {new Date(event.event_date).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-end gap-4 pt-4 border-t">
                      {selectedEvent === event.event_id ? (
                        <div className="flex-1 space-y-2">
                          <Label htmlFor={`source-${event.event_id}`}>
                            Add Credible Source URL
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id={`source-${event.event_id}`}
                              placeholder="https://reuters.com/article..."
                              value={newSourceUrl}
                              onChange={(e) => setNewSourceUrl(e.target.value)}
                            />
                            <Button
                              onClick={() => handleAttachSource(event.event_id)}
                            >
                              Add Source
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedEvent(null);
                                setNewSourceUrl('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => setSelectedEvent(event.event_id)}
                          >
                            Attach Source
                          </Button>
                          
                          <Button
                            variant="default"
                            onClick={() => handleEscalateVerification(event.event_id)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Escalate to Corroborated
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}