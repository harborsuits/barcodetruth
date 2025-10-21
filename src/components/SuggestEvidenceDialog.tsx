import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type SuggestEvidenceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  brandName: string;
};

export function SuggestEvidenceDialog({ open, onOpenChange, brandId, brandName }: SuggestEvidenceDialogProps) {
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!url.trim()) {
      toast({
        title: 'URL required',
        description: 'Please provide a source URL',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Sign in required',
          description: 'Please sign in to suggest evidence',
          variant: 'destructive'
        });
        return;
      }

      const { error } = await supabase
        .from('user_submissions')
        .insert({
          user_id: user.id,
          brand_id: brandId,
          kind: 'suggest_evidence',
          url: url.trim(),
          note: note.trim() || null
        });

      if (error) throw error;

      toast({
        title: 'Evidence submitted',
        description: 'Thank you! We\'ll review this source'
      });
      setUrl('');
      setNote('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error submitting suggestion:', error);
      toast({
        title: 'Failed to submit',
        description: error.message || 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suggest evidence</DialogTitle>
          <DialogDescription>
            Share a source about {brandName}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="url">Source URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="note">Additional context (optional)</Label>
            <Textarea
              id="note"
              placeholder="Why is this source important? What category does it relate to?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Evidence'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
