import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, AlertCircle, Heart, HeartOff, Clock, CheckCircle2, Filter, Bell, BellOff, Home, Info, ExternalLink } from "lucide-react";
import { ScoreExplainDrawer } from "@/components/brand/ScoreExplainDrawer";
import { ConfidenceChip } from "@/components/brand/ConfilePos";
import { LastUpdatedBadge } from "@/components/brand/LastUpdatedBadge";
import { BrandWikiEnrichment } from "@/components/BrandWikiEnrichment";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetHeader,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EventCard, BrandEvent } from "@/components/EventCard";
import { formatDate, formatMonth, topImpacts } from "@/lib/events";
import { supabase } from "@/integrations/supabase/client";
import { Button as ShadButton } from "@/components/ui/button";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import { EventTimeline } from "@/components/EventTimeline";
import { TrustIndicators } from "@/components/TrustIndicators";
import { InsufficientDataBadge } from "@/components/InsufficientDataBadge";
import { isVerifiedBrand } from "@/lib/realOnly";

export const Brand = () => {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: brand, isLoading: isLoadingBrand, isError: isErrorBrand } = useQuery({
    queryKey: ['brand', brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .single();

      if (error) {
        console.error("Error fetching brand:", error);
        throw new Error(error.message);
      }
      return data;
    },
    enabled: !!brandId,
  });

  const { data: events, isLoading: isLoadingEvents, isError: isErrorEvents } = useQuery({
    queryKey: ['brandEvents', brandId, selectedCategory],
    queryFn: async () => {
      let query = supabase
        .from('brand_events')
        .select('*')
        .eq('brand_id', brandId)
        .order('event_date', { ascending: false })
        .limit(showAllEvents ? 500 : 5);

      if (selectedCategory) {
        query = query.eq('category', selectedCategory);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching brand events:", error);
        throw new Error(error.message);
      }
      return data;
    },
    enabled: !!brandId,
  });

  const { data: categoryScores, isLoading: isLoadingCategoryScores, isError: isErrorCategoryScores } = useQuery({
    queryKey: ['categoryScores', brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_category_scores')
        .select('*')
        .eq('brand_id', brandId);

      if (error) {
        console.error("Error fetching category scores:", error);
        throw new Error(error.message);
      }
      return data;
    },
    enabled: !!brandId,
  });

  const { data: trustIndicators, isLoading: isLoadingTrustIndicators, isError: isErrorTrustIndicators } = useQuery({
    queryKey: ['trustIndicators', brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trust_indicators')
        .select('verified_count, sources')
        .eq('brand_id', brandId)
        .single();

      if (error) {
        console.error("Error fetching trust indicators:", error);
        throw new Error(error.message);
      }
      return data;
    },
    enabled: !!brandId,
  });

  const { data: overallScore, isLoading: isLoadingOverallScore, isError: isErrorOverallScore } = useQuery({
    queryKey: ['overallScore', brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_overall_scores')
        .select('overall_score')
        .eq('brand_id', brandId)
        .single();

      if (error) {
        console.error("Error fetching overall score:", error);
        throw new Error(error.message);
      }
      return data?.overall_score;
    },
    enabled: !!brandId,
  });

  const { mutate: followBrand, isLoading: isFollowingLoading } = useMutation(
    async () => {
      if (!brandId) {
        throw new Error("Brand ID is required to follow.");
      }

      const { data, error } = await supabase
        .from('user_brand_follows')
        .insert([{ user_id: supabase.auth.user()?.id, brand_id: brandId }]);

      if (error) {
        console.error("Error following brand:", error);
        throw new Error(error.message);
      }

      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['followedBrands']);
        setIsFollowing(true);
        toast({
          title: "Success!",
          description: "You are now following this brand.",
        })
      },
      onError: (error: any) => {
        toast({
          title: "Error!",
          description: error.message,
        })
      },
    }
  );

  const { mutate: unfollowBrand, isLoading: isUnfollowingLoading } = useMutation(
    async () => {
      if (!brandId) {
        throw new Error("Brand ID is required to unfollow.");
      }

      const { data, error } = await supabase
        .from('user_brand_follows')
        .delete()
        .eq('user_id', supabase.auth.user()?.id)
        .eq('brand_id', brandId);

      if (error) {
        console.error("Error unfollowing brand:", error);
        throw new Error(error.message);
      }

      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['followedBrands']);
        setIsFollowing(false);
        toast({
          title: "Success!",
          description: "You have unfollowed this brand.",
        })
      },
      onError: (error: any) => {
        toast({
          title: "Error!",
          description: error.message,
        })
      },
    }
  );

  const handleCategorySelect = (category: string | null) => {
    setSelectedCategory(category);
  };

  if (isLoadingBrand) return <div>Loading brand...</div>;
  if (isErrorBrand) return <div>Error loading brand.</div>;
  if (!brand) return <div>Brand not found.</div>;

  const top3Impacts = topImpacts(events || []);

  return (
    <div className="min-h-screen bg-background">
      <BrandWikiEnrichment brandId={brandId!} hasDescription={!!brand?.description} />
      <div className="container mx-auto py-8">
        <Breadcrumbs
          segments={[
            { label: "Home", href: "/" },
            { label: "Brands", href: "/brands" },
            { label: brand.name, href: `/brand/${brandId}` },
          ]}
        />
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={brand.logo_url} alt={`${brand.name} Logo`} className="h-12 w-12 rounded-full" />
            <div>
              <h1 className="text-2xl font-bold">{brand.name}</h1>
              <div className="flex items-center space-x-2">
                {isVerifiedBrand(brand.id) && (
                  <Badge variant="outline">
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Verified Brand
                  </Badge>
                )}
                {brand.real_only === false && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    Simulated Brand
                  </Badge>
                )}
                <LastUpdatedBadge lastUpdated={brand.updated_at} />
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {supabase.auth.user() ? (
              <Button
                variant="outline"
                onClick={() => {
                  isFollowing ? unfollowBrand() : followBrand();
                }}
                disabled={isFollowingLoading || isUnfollowingLoading}
              >
                {isFollowing ? <><BellOff className="h-4 w-4 mr-2" />Unfollow</> : <><Bell className="h-4 w-4 mr-2" />Follow</>}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => toast({
                title: "Please sign in",
                description: "You must be signed in to follow brands.",
              })}>
                <Bell className="h-4 w-4 mr-2" />
                Follow
              </Button>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">
                  <Info className="h-4 w-4 mr-2" />
                  About
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-lg">
                <SheetHeader>
                  <SheetTitle>{brand.name}</SheetTitle>
                  <SheetDescription>
                    Learn more about {brand.name} and its mission.
                  </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <p className="text-right">Description</p>
                    <p className="col-span-3 text-left">{brand.description || "No description available."}</p>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <p className="text-right">Website</p>
                    <a href={brand.website_url} target="_blank" rel="noopener noreferrer" className="col-span-3 text-left text-blue-500 hover:underline flex items-center">
                      Visit Website
                      <ExternalLink className="h-4 w-4 ml-1" />
                    </a>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <Tabs defaultValue="events" className="space-y-4">
          <TabsList>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="score">Score</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
          </TabsList>
          <TabsContent value="events" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent Events</h2>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => setShowAllEvents(!showAllEvents)}>
                  {showAllEvents ? "Show Less" : "Show All"}
                </Button>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter by Category
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="sm:max-w-sm">
                    <SheetHeader>
                      <SheetTitle>Filter Events</SheetTitle>
                      <SheetDescription>
                        Select a category to filter events.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="grid gap-4 py-4">
                      <Button variant="outline" onClick={() => handleCategorySelect(null)} className={selectedCategory === null ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : ""}>
                        All Categories
                      </Button>
                      <Button variant="outline" onClick={() => handleCategorySelect('labor')} className={selectedCategory === 'labor' ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : ""}>
                        Labor
                      </Button>
                      <Button variant="outline" onClick={() => handleCategorySelect('environment')} className={selectedCategory === 'environment' ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : ""}>
                        Environment
                      </Button>
                      <Button variant="outline" onClick={() => handleCategorySelect('politics')} className={selectedCategory === 'politics' ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : ""}>
                        Politics
                      </Button>
                      <Button variant="outline" onClick={() => handleCategorySelect('social')} className={selectedCategory === 'social' ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : ""}>
                        Social
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
            {isLoadingEvents ? (
              <div>Loading events...</div>
            ) : isErrorEvents ? (
              <div>Error loading events.</div>
            ) : events && events.length > 0 ? (
              <div className="grid gap-4">
                {events.map((event: BrandEvent) => (
                  <EventCard key={event.event_id} event={event} />
                ))}
              </div>
            ) : (
              <div>No events found.</div>
            )}
          </TabsContent>
          <TabsContent value="score" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Overall Score</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingOverallScore ? (
                    <div>Loading overall score...</div>
                  ) : isErrorOverallScore ? (
                    <div>Error loading overall score.</div>
                  ) : overallScore !== null ? (
                    <div className="text-3xl font-bold">{overallScore.toFixed(2)}</div>
                  ) : (
                    <InsufficientDataBadge />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Category Scores</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingCategoryScores ? (
                    <div>Loading category scores...</div>
                  ) : isErrorCategoryScores ? (
                    <div>Error loading category scores.</div>
                  ) : categoryScores && categoryScores.length > 0 ? (
                    <ScoreBreakdown categoryScores={categoryScores} />
                  ) : (
                    <InsufficientDataBadge />
                  )}
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Key Impact Indicators</CardTitle>
                <CardContent>
                  {isLoadingEvents ? (
                    <div>Loading events...</div>
                  ) : isErrorEvents ? (
                    <div>Error loading events.</div>
                  ) : top3Impacts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {top3Impacts.map((impact, index) => (
                        <div key={index} className="p-4 border rounded-md">
                          <h3 className="text-lg font-semibold">{impact.category}</h3>
                          <p className="text-sm">
                            {formatDate(impact.event_date)} - {impact.title}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>No significant impacts found.</div>
                  )}
                </CardContent>
              </CardHeader>
            </Card>
          </TabsContent>
          <TabsContent value="evidence" className="space-y-4">
            <EventTimeline brandId={brandId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
