import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RatingInput, CategoryKey } from "@/types/community";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RateBrandModalProps {
  brandId: string;
  brandName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: 'labor', label: 'Labor' },
  { key: 'environment', label: 'Environment' },
  { key: 'politics', label: 'Politics' },
  { key: 'social', label: 'Social' },
];

const SCORE_OPTIONS = [
  { value: 1, label: 'Strongly Negative' },
  { value: 2, label: 'Negative' },
  { value: 3, label: 'Mixed/Neutral' },
  { value: 4, label: 'Positive' },
  { value: 5, label: 'Strongly Positive' },
];

export function RateBrandModal({ brandId, brandName, open, onOpenChange }: RateBrandModalProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<CategoryKey>>(new Set());
  const queryClient = useQueryClient();
  
  const { register, handleSubmit, watch, setValue, reset } = useForm<Record<CategoryKey, any>>({
    defaultValues: {
      labor: {},
      environment: {},
      politics: {},
      social: {},
    },
  });

  // Fetch recent events for evidence picker
  const { data: recentEvents } = useQuery({
    queryKey: ['brand-events', brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_events')
        .select('event_id, title, category, event_date')
        .eq('brand_id', brandId)
        .order('event_date', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const rateMutation = useMutation({
    mutationFn: async (formData: Record<CategoryKey, any>) => {
      const ratings: RatingInput[] = [];
      
      CATEGORIES.forEach(({ key }) => {
        const score = formData[key]?.score;
        if (score) {
          ratings.push({
            category: key,
            score: parseInt(score, 10),
            evidence_event_id: formData[key]?.evidence_event_id || undefined,
            evidence_url: formData[key]?.evidence_url || undefined,
            context_note: formData[key]?.context_note || undefined,
          });
        }
      });

      if (ratings.length === 0) {
        throw new Error('Please rate at least one category');
      }

      const { data, error } = await supabase.functions.invoke('community-rate', {
        body: { brand_id: brandId, ratings },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Your ratings have been submitted!');
      queryClient.invalidateQueries({ queryKey: ['community-outlook', brandId] });
      onOpenChange(false);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit ratings');
    },
  });

  const toggleCategory = (category: CategoryKey) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rate {brandName}</DialogTitle>
          <DialogDescription>
            Share your perspective on {brandName}'s conduct in each category. Your ratings help the community.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((data) => rateMutation.mutate(data))} className="space-y-6">
          {CATEGORIES.map(({ key, label }) => (
            <div key={key} className="space-y-3 pb-4 border-b">
              <Label className="text-base font-semibold">{label}</Label>
              
              <RadioGroup
                value={watch(`${key}.score`)}
                onValueChange={(value) => setValue(`${key}.score`, value)}
                className="flex flex-col space-y-2"
              >
                {SCORE_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value.toString()} id={`${key}-${option.value}`} />
                    <Label htmlFor={`${key}-${option.value}`} className="cursor-pointer font-normal">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {watch(`${key}.score`) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleCategory(key)}
                  className="text-xs"
                >
                  {expandedCategories.has(key) ? (
                    <>
                      <ChevronUp className="w-3 h-3 mr-1" /> Hide evidence options
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 mr-1" /> Add evidence (optional)
                    </>
                  )}
                </Button>
              )}

              {expandedCategories.has(key) && (
                <div className="space-y-3 pl-4 border-l-2">
                  <div>
                    <Label htmlFor={`${key}-event`} className="text-sm">Pick a recent event</Label>
                    <Select
                      value={watch(`${key}.evidence_event_id`)}
                      onValueChange={(value) => setValue(`${key}.evidence_event_id`, value)}
                    >
                      <SelectTrigger id={`${key}-event`}>
                        <SelectValue placeholder="Select an event..." />
                      </SelectTrigger>
                      <SelectContent>
                        {recentEvents?.filter(e => e.category === key).map((event) => (
                          <SelectItem key={event.event_id} value={event.event_id}>
                            {event.title || 'Untitled event'} ({new Date(event.event_date).toLocaleDateString()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor={`${key}-url`} className="text-sm">Or paste a source URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id={`${key}-url`}
                        type="url"
                        placeholder="https://..."
                        {...register(`${key}.evidence_url`)}
                      />
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`${key}-note`} className="text-sm">Brief context (140 chars max)</Label>
                    <Textarea
                      id={`${key}-note`}
                      placeholder="Optional: why this rating?"
                      maxLength={140}
                      rows={2}
                      {...register(`${key}.context_note`)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {watch(`${key}.context_note`)?.length || 0}/140
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={rateMutation.isPending}>
              {rateMutation.isPending ? 'Submitting...' : 'Submit Ratings'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
