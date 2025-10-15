import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, Plus } from 'lucide-react';

interface AttachSourceProps {
  eventId: string;
  brandName: string;
  onSourceAttached: () => void;
}

export function AttachSource({ eventId, brandName, onSourceAttached }: AttachSourceProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAttach = async () => {
    if (!url || !title) return;

    setLoading(true);
    try {
      // Insert the source as primary
      const { error } = await supabase
        .from('event_sources')
        .insert({
          event_id: eventId,
          source_url: url,
          canonical_url: url,
          title: title,
          source_name: new URL(url).hostname,
          is_primary: true,
          link_kind: 'article'
        });

      if (error) throw error;

      toast({
        title: 'Source attached',
        description: `Primary source added for ${brandName}`,
      });

      setOpen(false);
      setUrl('');
      setTitle('');
      onSourceAttached();
    } catch (error: any) {
      toast({
        title: 'Failed to attach source',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Plus className="h-3 w-3" />
        Attach Source
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach Primary Source</DialogTitle>
            <DialogDescription>
              Add a clickable primary source for this evidence item. This will immediately resolve the "No primary sources attached yet" status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
              <Label htmlFor="title">Source Title</Label>
              <Input
                id="title"
                placeholder="Brief description of the source"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAttach} 
                disabled={!url || !title || loading}
              >
                {loading ? 'Attaching...' : 'Attach Source'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}