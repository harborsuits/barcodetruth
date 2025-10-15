import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface TriggerIngestionProps {
  brandId: string;
  brandName: string;
}

export function TriggerIngestion({ brandId, brandName }: TriggerIngestionProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleTrigger = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-brand-ingestion', {
        body: { brand_id: brandId }
      });

      if (error) throw error;

      const results = data?.results || {};
      const successCount = Object.values(results).filter((r: any) => r.success).length;
      const totalCount = Object.keys(results).length;

      toast({
        title: 'Ingestion triggered',
        description: `${successCount}/${totalCount} sources succeeded for ${brandName}. Check the backend logs for details.`,
      });

      // Refresh the page after a short delay to show new data
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      console.error('Ingestion error:', error);
      toast({
        title: 'Ingestion failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Manual Ingestion</h3>
        <p className="text-sm text-muted-foreground">
          Fetch fresh data from OSHA, EPA, FDA, FEC, and news sources for {brandName}.
        </p>
        <Button 
          onClick={handleTrigger} 
          disabled={loading}
          size="sm"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? 'Ingesting...' : 'Trigger Ingestion'}
        </Button>
      </div>
    </Card>
  );
}
