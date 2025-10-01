import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";

interface SourceCredibility {
  id: string;
  source_name: string;
  base_credibility: number;
  dynamic_adjustment: number;
  notes: string;
}

export function SourceCredibilityManager() {
  const { toast } = useToast();
  const [sources, setSources] = useState<SourceCredibility[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    const { data, error } = await supabase
      .from('source_credibility')
      .select('*')
      .order('source_name');

    if (error) {
      toast({
        title: 'Error loading sources',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setSources(data || []);
    }
    setLoading(false);
  };

  const updateCredibility = async (id: string, updates: Partial<SourceCredibility>) => {
    const { error } = await supabase
      .from('source_credibility')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Updated successfully' });
      loadSources();
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading sources...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Source Credibility Management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {sources.map((source) => (
          <div key={source.id} className="space-y-3 p-4 border rounded-lg">
            <div className="font-semibold">{source.source_name}</div>
            
            <div className="space-y-2">
              <Label>Base Credibility: {(Number(source.base_credibility) * 100).toFixed(0)}%</Label>
              <Slider
                value={[Number(source.base_credibility) * 100]}
                onValueChange={([value]) => 
                  updateCredibility(source.id, { base_credibility: value / 100 })
                }
                min={0}
                max={100}
                step={5}
              />
            </div>

            <div className="space-y-2">
              <Label>Dynamic Adjustment: {(Number(source.dynamic_adjustment) * 100).toFixed(0)}%</Label>
              <Slider
                value={[Number(source.dynamic_adjustment) * 100 + 50]}
                onValueChange={([value]) => 
                  updateCredibility(source.id, { dynamic_adjustment: (value - 50) / 100 })
                }
                min={0}
                max={100}
                step={5}
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Input
                value={source.notes || ''}
                onChange={(e) => updateCredibility(source.id, { notes: e.target.value })}
                placeholder="Add notes about this source..."
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
