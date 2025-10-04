import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast as sonnerToast } from "sonner";

interface AddSourceDrawerProps {
  onSuccess?: () => void;
}

export function AddSourceDrawer({ onSuccess }: AddSourceDrawerProps) {
  const { toast } = useToast();
  const isAdmin = useIsAdmin();
  const [url, setUrl] = useState("");
  const [brandId, setBrandId] = useState("");
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState<'labor' | 'environment' | 'politics' | 'social'>('social');
  const [severity, setSeverity] = useState<'minor' | 'moderate' | 'severe'>('moderate');
  const [occurredAt, setOccurredAt] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleFetchPreview = async () => {
    if (!url || !brandId || !brandName) {
      toast({
        title: "Missing fields",
        description: "Please fill in URL, Brand ID, and Brand Name",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ingest-external-source', {
        body: {
          url,
          brand_id: brandId,
          brand_name: brandName,
          category,
          severity,
          occurred_at: occurredAt || undefined
        }
      });

      if (error) throw error;
      
      setPreview(data.preview);
      sonnerToast.success("Source added and archiving queued", {
        description: "Event ingested successfully"
      });
      
      onSuccess?.();
    } catch (error: any) {
      console.error('Ingest error:', error);
      sonnerToast.error(error?.message ?? "Failed to add source", {
        description: "Check console for details"
      });
    } finally {
      setLoading(false);
    }
  };

  // Admin-only guard
  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Admin access required</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="url">Article URL</Label>
          <Input
            id="url"
            placeholder="https://example.com/article"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="brandId">Brand ID (UUID)</Label>
            <Input
              id="brandId"
              placeholder="uuid-from-brands-table"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="brandName">Brand Name</Label>
            <Input
              id="brandName"
              placeholder="Company Name"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={(v: any) => setCategory(v)}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="labor">Labor</SelectItem>
                <SelectItem value="environment">Environment</SelectItem>
                <SelectItem value="politics">Politics</SelectItem>
                <SelectItem value="social">Social</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="severity">Severity</Label>
            <Select value={severity} onValueChange={(v: any) => setSeverity(v)}>
              <SelectTrigger id="severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minor">Minor</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="severe">Severe</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="occurredAt">Occurred Date (optional)</Label>
          <Input
            id="occurredAt"
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </div>

        <Button
          onClick={handleFetchPreview}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Ingesting...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Fetch & Create Event
            </>
          )}
        </Button>
      </div>

      {preview && (
        <Card className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold">{preview.title}</h3>
            <Badge variant="outline">{preview.verification}</Badge>
          </div>
          
          <div className="text-sm space-y-2">
            <div>
              <span className="font-medium">Domain:</span> {preview.domain}
            </div>
            <div>
              <span className="font-medium">Credibility:</span> {preview.credibility}
            </div>
          </div>

          {preview.quote && (
            <blockquote className="text-sm italic text-muted-foreground border-l-2 border-border pl-3">
              "{preview.quote}"
            </blockquote>
          )}

          {preview.facts && (
            <div className="text-xs space-y-1 text-muted-foreground">
              <div className="font-medium">Extracted Facts:</div>
              {preview.facts.amount && <div>Amount: ${preview.facts.amount.toLocaleString()}</div>}
              {preview.facts.recall_class && <div>Recall Class: {preview.facts.recall_class}</div>}
              {preview.facts.lawsuit && <div>Lawsuit: Yes</div>}
              {preview.facts.settlement && <div>Settlement: Yes</div>}
              {preview.facts.recipient_party && <div>Party: {preview.facts.recipient_party}</div>}
            </div>
          )}

          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View Original <ExternalLink className="h-3 w-3" />
          </a>
        </Card>
      )}
    </div>
  );
}
