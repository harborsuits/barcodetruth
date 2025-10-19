import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, Clock, ArrowLeft } from 'lucide-react';

interface Claim {
  id: string;
  barcode_ean13: string;
  claimed_brand_id: string;
  product_name: string | null;
  status: 'pending' | 'verified' | 'rejected';
  confidence: number;
  created_at: string;
  created_by: string | null;
  score: number;
  upvotes: number;
  downvotes: number;
  rejection_reason: string | null;
}

export default function AdminClaims() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [filter, setFilter] = useState<'pending' | 'verified' | 'rejected'>('pending');
  const [moderating, setModerating] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAndLoadClaims();
  }, [filter]);

  async function checkAdminAndLoadClaims() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      // Check admin role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleError || !roleData) {
        toast({
          title: 'Unauthorized',
          description: 'Admin access required',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setIsAdmin(true);

      // Load claims from moderator view
      const { data, error } = await supabase
        .from('product_claims_moderator')
        .select('*')
        .eq('status', filter)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClaims(data || []);
    } catch (error: any) {
      console.error('Error loading claims:', error);
      toast({
        title: 'Error',
        description: 'Failed to load claims',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleModerate(claimId: string, action: 'verify' | 'reject') {
    setModerating(claimId);
    try {
      const { data, error } = await supabase.functions.invoke('moderate-claim', {
        body: {
          claim_id: claimId,
          action,
          rejection_reason: action === 'reject' ? rejectionReason : undefined,
        },
      });

      if (error) throw error;

      toast({
        title: action === 'verify' ? 'Claim verified' : 'Claim rejected',
        description: `Successfully ${action === 'verify' ? 'verified' : 'rejected'} the claim`,
      });

      setShowRejectDialog(null);
      setRejectionReason('');
      checkAdminAndLoadClaims();
    } catch (error: any) {
      console.error('Moderation error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to moderate claim',
        variant: 'destructive',
      });
    } finally {
      setModerating(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold mb-2">Claim Moderation</h1>
          <p className="text-muted-foreground">
            Review and moderate community product claims
          </p>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">
            <Clock className="w-4 h-4 mr-2" />
            Pending
          </TabsTrigger>
          <TabsTrigger value="verified">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Verified
          </TabsTrigger>
          <TabsTrigger value="rejected">
            <XCircle className="w-4 h-4 mr-2" />
            Rejected
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6 space-y-4">
          {claims.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No {filter} claims found
            </Card>
          ) : (
            claims.map((claim) => (
              <Card key={claim.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant={
                        claim.status === 'verified' ? 'default' :
                        claim.status === 'rejected' ? 'destructive' : 'secondary'
                      }>
                        {claim.status}
                      </Badge>
                      <span className="font-mono text-sm text-muted-foreground">
                        {claim.barcode_ean13}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold mb-1">
                      {claim.product_name || 'Unnamed Product'}
                    </h3>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <span>Brand ID: {claim.claimed_brand_id}</span>
                      <span>•</span>
                      <span>Confidence: {claim.confidence}%</span>
                      <span>•</span>
                      <span className="text-green-600">↑ {claim.upvotes}</span>
                      <span className="text-red-600">↓ {claim.downvotes}</span>
                      <span>•</span>
                      <span className="font-semibold">Score: {claim.score}</span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Created: {new Date(claim.created_at).toLocaleString()}
                    </p>

                    {claim.rejection_reason && (
                      <p className="mt-2 text-sm text-destructive">
                        Rejection reason: {claim.rejection_reason}
                      </p>
                    )}
                  </div>

                  {claim.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        disabled={moderating === claim.id}
                        onClick={() => handleModerate(claim.id, 'verify')}
                      >
                        {moderating === claim.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Verify
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={moderating === claim.id}
                        onClick={() => setShowRejectDialog(claim.id)}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>

                {showRejectDialog === claim.id && (
                  <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                    <label className="text-sm font-medium mb-2 block">
                      Rejection Reason
                    </label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter reason for rejection..."
                      className="mb-3"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={moderating === claim.id || !rejectionReason.trim()}
                        onClick={() => handleModerate(claim.id, 'reject')}
                      >
                        {moderating === claim.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Confirm Reject'
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowRejectDialog(null);
                          setRejectionReason('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
