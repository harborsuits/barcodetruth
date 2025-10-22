import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';
import { ThumbsUp, ThumbsDown, Trash2, RefreshCw, Users, Star, TrendingUp, User } from 'lucide-react';
import { toast } from 'sonner';

type RatingCategory = 'labor' | 'environment' | 'politics' | 'social' | 'leadership' | 'ethics' | 'transparency' | 'social_impact' | 'environmental' | 'labor_practices';

export default function AdminCommunityRatings() {
  const [activeTab, setActiveTab] = useState<'brands' | 'people'>('brands');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch brand ratings
  const { data: brandRatings, isLoading: loadingBrands, refetch: refetchBrands } = useQuery({
    queryKey: ['admin-brand-ratings', categoryFilter, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('community_ratings')
        .select(`
          *,
          brands:brand_id (
            id,
            name,
            logo_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000
  });

  // Fetch person ratings
  const { data: personRatings, isLoading: loadingPeople, refetch: refetchPeople } = useQuery({
    queryKey: ['admin-person-ratings', categoryFilter, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('person_ratings')
        .select(`
          *,
          company_people:person_id (
            id,
            person_name,
            role,
            image_url,
            companies:company_id (
              name
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000
  });

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ['rating-stats', activeTab],
    queryFn: async () => {
      if (activeTab === 'brands') {
        const { data, error } = await supabase
          .from('community_ratings')
          .select('category, score, user_id, brand_id');
        
        if (error) throw error;
        
        const byCategory: Record<string, { count: number; avg: number; scores: number[] }> = {};
        const uniqueUsers = new Set();
        const uniqueBrands = new Set();
        
        data?.forEach(r => {
          if (!byCategory[r.category]) {
            byCategory[r.category] = { count: 0, avg: 0, scores: [] };
          }
          byCategory[r.category].count++;
          byCategory[r.category].scores.push(r.score);
          uniqueUsers.add(r.user_id);
          uniqueBrands.add(r.brand_id);
        });
        
        Object.keys(byCategory).forEach(cat => {
          const scores = byCategory[cat].scores;
          byCategory[cat].avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        });
        
        return {
          total: data?.length || 0,
          uniqueUsers: uniqueUsers.size,
          uniqueEntities: uniqueBrands.size,
          byCategory
        };
      } else {
        const { data, error } = await supabase
          .from('person_ratings')
          .select('category, score, user_id, person_id');
        
        if (error) throw error;
        
        const byCategory: Record<string, { count: number; avg: number; scores: number[] }> = {};
        const uniqueUsers = new Set();
        const uniquePeople = new Set();
        
        data?.forEach(r => {
          if (!byCategory[r.category]) {
            byCategory[r.category] = { count: 0, avg: 0, scores: [] };
          }
          byCategory[r.category].count++;
          byCategory[r.category].scores.push(r.score);
          uniqueUsers.add(r.user_id);
          uniquePeople.add(r.person_id);
        });
        
        Object.keys(byCategory).forEach(cat => {
          const scores = byCategory[cat].scores;
          byCategory[cat].avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        });
        
        return {
          total: data?.length || 0,
          uniqueUsers: uniqueUsers.size,
          uniqueEntities: uniquePeople.size,
          byCategory
        };
      }
    }
  });

  const handleDeleteRating = async (id: string, type: 'brand' | 'person') => {
    try {
      const table = type === 'brand' ? 'community_ratings' : 'person_ratings';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Rating deleted');
      if (type === 'brand') {
        refetchBrands();
      } else {
        refetchPeople();
      }
    } catch (error) {
      console.error('Error deleting rating:', error);
      toast.error('Failed to delete rating');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 8) return 'default';
    if (score >= 5) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Community Ratings</h1>
            <p className="text-muted-foreground">
              Monitor and moderate community ratings for brands and key people
            </p>
          </div>
          <Button onClick={() => activeTab === 'brands' ? refetchBrands() : refetchPeople()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Ratings</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="text-2xl font-bold">{stats.total}</div>
              ) : (
                <Skeleton className="h-8 w-16" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Raters</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
              ) : (
                <Skeleton className="h-8 w-16" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{activeTab === 'brands' ? 'Brands Rated' : 'People Rated'}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="text-2xl font-bold">{stats.uniqueEntities}</div>
              ) : (
                <Skeleton className="h-8 w-16" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="text-2xl font-bold">{Object.keys(stats.byCategory).length}</div>
              ) : (
                <Skeleton className="h-8 w-16" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Category Statistics */}
        {stats && Object.keys(stats.byCategory).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(stats.byCategory).map(([category, data]) => (
                  <div key={category} className="p-4 rounded-lg border">
                    <div className="font-semibold capitalize mb-2">{category.replace(/_/g, ' ')}</div>
                    <div className="text-2xl font-bold mb-1">{data.count}</div>
                    <div className="text-sm text-muted-foreground">
                      Avg: {data.avg.toFixed(1)}/10
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex gap-4">
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="labor">Labor</SelectItem>
              <SelectItem value="environment">Environment</SelectItem>
              <SelectItem value="politics">Politics</SelectItem>
              <SelectItem value="social">Social</SelectItem>
              <SelectItem value="leadership">Leadership</SelectItem>
              <SelectItem value="ethics">Ethics</SelectItem>
              <SelectItem value="transparency">Transparency</SelectItem>
              <SelectItem value="social_impact">Social Impact</SelectItem>
              <SelectItem value="environmental">Environmental</SelectItem>
              <SelectItem value="labor_practices">Labor Practices</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs for Brands vs People */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'brands' | 'people')}>
          <TabsList>
            <TabsTrigger value="brands">Brand Ratings</TabsTrigger>
            <TabsTrigger value="people">Key People Ratings</TabsTrigger>
          </TabsList>

          <TabsContent value="brands" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Brand Ratings</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingBrands ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : !brandRatings || brandRatings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No brand ratings yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {brandRatings.map((rating: any) => (
                      <div 
                        key={rating.id} 
                        className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        {rating.brands?.logo_url && (
                          <img 
                            src={rating.brands.logo_url} 
                            alt={rating.brands.name}
                            className="w-12 h-12 rounded-lg object-contain bg-background p-1 border"
                          />
                        )}
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{rating.brands?.name || 'Unknown Brand'}</span>
                            <Badge variant="outline" className="capitalize">
                              {rating.category.replace(/_/g, ' ')}
                            </Badge>
                            <Badge variant={getScoreBadge(rating.score)}>
                              {rating.score}/10
                            </Badge>
                          </div>
                          
                          {rating.context_note && (
                            <p className="text-sm text-muted-foreground">{rating.context_note}</p>
                          )}
                          
                          {rating.evidence_url && (
                            <a 
                              href={rating.evidence_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              View Evidence →
                            </a>
                          )}
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{rating.user_id.slice(0, 8)}...</span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(rating.created_at), { addSuffix: true })}</span>
                            {rating.weight !== 1 && (
                              <>
                                <span>•</span>
                                <span>Weight: {rating.weight}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Rating?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this community rating. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteRating(rating.id, 'brand')}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="people" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Key People Ratings</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPeople ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : !personRatings || personRatings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No person ratings yet</p>
                    <p className="text-sm mt-1">Community can rate CEOs, founders, and key executives</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {personRatings.map((rating: any) => (
                      <div 
                        key={rating.id} 
                        className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        {rating.company_people?.image_url ? (
                          <img 
                            src={rating.company_people.image_url} 
                            alt={rating.company_people.person_name}
                            className="w-12 h-12 rounded-full object-cover border"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border">
                            <User className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{rating.company_people?.person_name || 'Unknown Person'}</span>
                            <Badge variant="outline" className="capitalize">
                              {rating.company_people?.role?.replace(/_/g, ' ')}
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {rating.category.replace(/_/g, ' ')}
                            </Badge>
                            <Badge variant={getScoreBadge(rating.score)}>
                              {rating.score}/10
                            </Badge>
                          </div>
                          
                          {rating.company_people?.companies?.name && (
                            <p className="text-sm text-muted-foreground">
                              at {rating.company_people.companies.name}
                            </p>
                          )}
                          
                          {rating.context_note && (
                            <p className="text-sm text-muted-foreground">{rating.context_note}</p>
                          )}
                          
                          {rating.evidence_url && (
                            <a 
                              href={rating.evidence_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              View Evidence →
                            </a>
                          )}
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{rating.user_id.slice(0, 8)}...</span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(rating.created_at), { addSuffix: true })}</span>
                            {rating.weight !== 1 && (
                              <>
                                <span>•</span>
                                <span>Weight: {rating.weight}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Rating?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this person rating. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteRating(rating.id, 'person')}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
