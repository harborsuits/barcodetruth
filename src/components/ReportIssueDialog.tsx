import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type ReportIssueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  eventId?: string;
  brandName: string;
};

export function ReportIssueDialog({ open, onOpenChange, brandId, eventId, brandName }: ReportIssueDialogProps) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!note.trim()) {
      toast({
        title: 'Note required',
        description: 'Please describe the issue',
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
          description: 'Please sign in to report issues',
          variant: 'destructive'
        });
        return;
      }

      const { error } = await supabase
        .from('user_submissions')
        .insert({
          user_id: user.id,
          brand_id: brandId,
          event_id: eventId || null,
          kind: 'report_issue',
          note: note.trim()
        });

      if (error) throw error;

      toast({
        title: 'Issue reported',
        description: 'Thank you for helping improve our data'
      });
      setNote('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error submitting report:', error);
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
          <DialogTitle>Report an issue</DialogTitle>
          <DialogDescription>
            Help us improve data quality for {brandName}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            placeholder="Describe the issue (e.g., incorrect categorization, duplicate event, wrong brand association...)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
