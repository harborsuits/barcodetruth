import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Flag } from "lucide-react";

const DISPUTE_TYPES = [
  { value: "wrong_brand", label: "This isn't about this brand" },
  { value: "incorrect_facts", label: "This event didn't happen / incorrect facts" },
  { value: "wrong_impact", label: "The impact score seems wrong" },
  { value: "other", label: "Other" },
] as const;

interface DisputeFormProps {
  eventId: string;
  brandId: string;
  eventTitle?: string | null;
  onClose: () => void;
}

export function DisputeForm({ eventId, brandId, eventTitle, onClose }: DisputeFormProps) {
  const [type, setType] = useState<string>("");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!type) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("event_disputes").insert({
        event_id: eventId,
        brand_id: brandId,
        dispute_type: type,
        supporting_url: url || null,
        email: email || null,
      } as any);
      if (error) throw error;
      toast({ title: "Dispute submitted", description: "We'll review this event and update the score if warranted." });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Flag className="h-3.5 w-3.5" />
        Dispute this event
      </div>
      {eventTitle && <p className="text-xs text-muted-foreground truncate">"{eventTitle}"</p>}

      <div className="space-y-2">
        {DISPUTE_TYPES.map(dt => (
          <label key={dt.value} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="dispute-type"
              value={dt.value}
              checked={type === dt.value}
              onChange={() => setType(dt.value)}
              className="accent-primary"
            />
            {dt.label}
          </label>
        ))}
      </div>

      <input
        type="url"
        placeholder="Supporting link (optional)"
        value={url}
        onChange={e => setUrl(e.target.value)}
        className="w-full text-sm px-3 py-2 rounded-md border border-border bg-background"
      />
      <input
        type="email"
        placeholder="Your email (for follow-up)"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full text-sm px-3 py-2 rounded-md border border-border bg-background"
      />

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={!type || submitting}>
          {submitting ? "Submitting…" : "Submit dispute"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
