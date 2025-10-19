import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  Trash2, 
  Archive, 
  Edit, 
  Eye,
  X,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Calendar
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface BrandEvent {
  event_id: string;
  brand_id: string;
  title: string;
  description: string;
  category: string;
  category_code: string | null;
  verification: string;
  event_date: string;
  created_at: string;
  is_irrelevant: boolean;
  relevance_score: number | null;
  ai_summary: string | null;
  brands: { name: string; logo_url: string | null } | null;
  event_sources: Array<{
    id: string;
    source_name: string;
    canonical_url: string;
    source_date: string | null;
  }>;
}

interface FilterState {
  search: string;
  category: string;
  verification: string;
  dateFrom: string;
  dateTo: string;
  showIrrelevant: boolean;
}

export default function AdminEvents() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    category: "all",
    verification: "all",
    dateFrom: "",
    dateTo: "",
    showIrrelevant: false,
  });
  
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkAction, setBulkAction] = useState<"irrelevant" | "category" | "delete" | null>(null);
  const [newCategory, setNewCategory] = useState<string>("labor");
  const [showEventDetails, setShowEventDetails] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Fetch events with filters
  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['admin-events', filters, page],
    queryFn: async () => {
      let query = supabase
        .from('brand_events')
        .select(`
          event_id,
          brand_id,
          title,
          description,
          category,
          category_code,
          verification,
          event_date,
          created_at,
          is_irrelevant,
          relevance_score,
          ai_summary,
          brands!inner(name, logo_url),
          event_sources(id, source_name, canonical_url, source_date)
        `, { count: 'exact' })
        .order('event_date', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      // Apply filters
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,brands.name.ilike.%${filters.search}%`);
      }
      
      if (filters.category !== 'all') {
        query = query.eq('category', filters.category as any);
      }
      
      if (filters.verification !== 'all') {
        query = query.eq('verification', filters.verification as any);
      }
      
      if (filters.dateFrom) {
        query = query.gte('event_date', filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query = query.lte('event_date', filters.dateTo);
      }
      
      if (!filters.showIrrelevant) {
        query = query.eq('is_irrelevant', false);
      }

      const { data, error, count } = await query;
      
      if (error) throw error;
      
      return { events: data as BrandEvent[], total: count || 0 };
    },
  });

  // Mark events as irrelevant
  const markIrrelevantMutation = useMutation({
    mutationFn: async (eventIds: string[]) => {
      const { error } = await supabase
        .from('brand_events')
        .update({ is_irrelevant: true })
        .in('event_id', eventIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      toast({ title: "Events marked as irrelevant" });
      setSelectedEvents(new Set());
      setBulkAction(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to mark events",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update category
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ eventIds, category }: { eventIds: string[]; category: string }) => {
      const { error } = await supabase
        .from('brand_events')
        .update({ category: category as any })
        .in('event_id', eventIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      toast({ title: "Category updated" });
      setSelectedEvents(new Set());
      setBulkAction(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update category",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete events
  const deleteEventsMutation = useMutation({
    mutationFn: async (eventIds: string[]) => {
      // First delete event_sources
      await supabase
        .from('event_sources')
        .delete()
        .in('event_id', eventIds);
      
      // Then delete events
      const { error } = await supabase
        .from('brand_events')
        .delete()
        .in('event_id', eventIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      toast({ title: "Events deleted" });
      setSelectedEvents(new Set());
      setBulkAction(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete events",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleBulkAction = () => {
    const eventIds = Array.from(selectedEvents);
    
    switch (bulkAction) {
      case 'irrelevant':
        markIrrelevantMutation.mutate(eventIds);
        break;
      case 'category':
        updateCategoryMutation.mutate({ eventIds, category: newCategory });
        break;
      case 'delete':
        deleteEventsMutation.mutate(eventIds);
        break;
    }
  };

  const toggleEventSelection = (eventId: string) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEvents(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const toggleSelectAll = () => {
    if (selectedEvents.size === eventsData?.events.length) {
      setSelectedEvents(new Set());
      setShowBulkActions(false);
    } else {
      const allIds = new Set(eventsData?.events.map(e => e.event_id) || []);
      setSelectedEvents(allIds);
      setShowBulkActions(true);
    }
  };

  const resetFilters = () => {
    setFilters({
      search: "",
      category: "all",
      verification: "all",
      dateFrom: "",
      dateTo: "",
      showIrrelevant: false,
    });
    setPage(1);
  };

  const totalPages = Math.ceil((eventsData?.total || 0) / pageSize);
  
  const selectedEvent = eventsData?.events.find(e => e.event_id === showEventDetails);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Event Management</h1>
                <p className="text-sm text-muted-foreground">
                  {eventsData?.total || 0} total events
                </p>
              </div>
            </div>
            {showBulkActions && (
              <Badge variant="secondary" className="text-base px-4 py-2">
                {selectedEvents.size} selected
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters
                </CardTitle>
                <CardDescription>Filter events by brand, category, date, etc.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={resetFilters}>
                <X className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Brand name, title, description..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={filters.category}
                  onValueChange={(value) => setFilters({ ...filters, category: value })}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="labor">Labor</SelectItem>
                    <SelectItem value="environment">Environment</SelectItem>
                    <SelectItem value="politics">Politics</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Verification */}
              <div className="space-y-2">
                <Label htmlFor="verification">Verification</Label>
                <Select
                  value={filters.verification}
                  onValueChange={(value) => setFilters({ ...filters, verification: value })}
                >
                  <SelectTrigger id="verification">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="official">Official</SelectItem>
                    <SelectItem value="corroborated">Corroborated</SelectItem>
                    <SelectItem value="unverified">Unverified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date From */}
              <div className="space-y-2">
                <Label htmlFor="dateFrom">From Date</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                />
              </div>

              {/* Date To */}
              <div className="space-y-2">
                <Label htmlFor="dateTo">To Date</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                />
              </div>

              {/* Show Irrelevant */}
              <div className="flex items-end pb-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showIrrelevant"
                    checked={filters.showIrrelevant}
                    onCheckedChange={(checked) => 
                      setFilters({ ...filters, showIrrelevant: checked as boolean })
                    }
                  />
                  <Label htmlFor="showIrrelevant" className="text-sm cursor-pointer">
                    Show irrelevant events
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions Bar */}
        {showBulkActions && (
          <Card className="border-primary">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkAction('irrelevant')}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Mark Irrelevant
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkAction('category')}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Change Category
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkAction('delete')}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedEvents(new Set());
                    setShowBulkActions(false);
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Selection
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Events Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">
                Loading events...
              </div>
            ) : !eventsData?.events.length ? (
              <div className="py-12 text-center text-muted-foreground">
                No events found matching your filters
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <Checkbox
                            checked={selectedEvents.size === eventsData.events.length}
                            onCheckedChange={toggleSelectAll}
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Brand</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Title</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Category</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Verification</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Sources</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {eventsData.events.map((event) => (
                        <tr
                          key={event.event_id}
                          className={`hover:bg-muted/30 ${
                            event.is_irrelevant ? 'opacity-50 bg-muted/20' : ''
                          } ${
                            selectedEvents.has(event.event_id) ? 'bg-primary/5' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={selectedEvents.has(event.event_id)}
                              onCheckedChange={() => toggleEventSelection(event.event_id)}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span>{new Date(event.event_date).toLocaleDateString()}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              {event.brands?.logo_url && (
                                <img
                                  src={event.brands.logo_url}
                                  alt=""
                                  className="w-6 h-6 rounded object-contain"
                                />
                              )}
                              <span className="font-medium">{event.brands?.name || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm max-w-md">
                            <div className="truncate font-medium">{event.title}</div>
                            <div className="flex items-center gap-2 mt-1">
                              {event.is_irrelevant && (
                                <Badge variant="outline" className="text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Irrelevant
                                </Badge>
                              )}
                              {event.relevance_score !== null && event.relevance_score < 9 && (
                                <Badge variant="destructive" className="text-xs">
                                  Low Rel: {event.relevance_score}
                                </Badge>
                              )}
                              {!/^[A-Za-z0-9\s.,!?'"()-]+$/.test(event.title) && (
                                <Badge variant="secondary" className="text-xs">
                                  Non-English
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              {event.category_code ? (
                                <>
                                  <Badge variant="default" className="text-xs font-mono">
                                    {event.category_code}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs capitalize ml-1">
                                    {event.category}
                                  </Badge>
                                </>
                              ) : (
                                <Badge variant="outline" className="capitalize">
                                  {event.category}
                                  <span className="ml-1 text-destructive">⚠️</span>
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                event.verification === 'official'
                                  ? 'default'
                                  : event.verification === 'corroborated'
                                  ? 'secondary'
                                  : 'outline'
                              }
                              className="capitalize"
                            >
                              {event.verification === 'official' && (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              )}
                              {event.verification}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-1">
                              {event.event_sources?.length || 0}
                              <span className="text-muted-foreground">sources</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowEventDetails(event.event_id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/brand/${event.brand_id}`)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Showing {(page - 1) * pageSize + 1} to{' '}
                      {Math.min(page * pageSize, eventsData.total)} of {eventsData.total}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <div className="text-sm">
                        Page {page} of {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Bulk Action Dialogs */}
      <AlertDialog open={bulkAction === 'irrelevant'} onOpenChange={() => setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {selectedEvents.size} events as irrelevant?</AlertDialogTitle>
            <AlertDialogDescription>
              These events will be hidden from users and excluded from scoring calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkAction}>
              Mark Irrelevant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={bulkAction === 'category'} onOpenChange={() => setBulkAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change category for {selectedEvents.size} events</DialogTitle>
            <DialogDescription>
              Select the new category for the selected events
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newCategory">New Category</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger id="newCategory">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="labor">Labor</SelectItem>
                  <SelectItem value="environment">Environment</SelectItem>
                  <SelectItem value="politics">Politics</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAction}>Update Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkAction === 'delete'} onOpenChange={() => setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedEvents.size} events?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The events and their sources will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkAction}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Events
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Event Details Dialog */}
      <Dialog open={!!showEventDetails} onOpenChange={() => setShowEventDetails(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
            <DialogDescription>
              {selectedEvent?.brands?.name} • {selectedEvent && new Date(selectedEvent.event_date).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedEvent.category_code ? (
                  <>
                    <Badge variant="default" className="font-mono">
                      {selectedEvent.category_code}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {selectedEvent.category}
                    </Badge>
                  </>
                ) : (
                  <Badge variant="outline" className="capitalize">
                    {selectedEvent.category}
                    <AlertTriangle className="h-3 w-3 ml-1 text-destructive" />
                  </Badge>
                )}
                <Badge variant="secondary" className="capitalize">
                  {selectedEvent.verification}
                </Badge>
                {selectedEvent.is_irrelevant && (
                  <Badge variant="destructive">Irrelevant</Badge>
                )}
                {selectedEvent.relevance_score !== null && (
                  <Badge variant={selectedEvent.relevance_score < 9 ? "destructive" : "secondary"}>
                    Rel: {selectedEvent.relevance_score}/20
                  </Badge>
                )}
                {!/^[A-Za-z0-9\s.,!?'"()-]+$/.test(selectedEvent.title) && (
                  <Badge variant="secondary">Non-English</Badge>
                )}
              </div>

              {selectedEvent.ai_summary && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">AI Summary</h4>
                  <p className="text-sm text-muted-foreground">{selectedEvent.ai_summary}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedEvent.description || "No description available"}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">
                  Sources ({selectedEvent.event_sources?.length || 0})
                </h4>
                <div className="space-y-2">
                  {selectedEvent.event_sources?.map((source) => (
                    <div key={source.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{source.source_name}</div>
                        {source.source_date && (
                          <div className="text-xs text-muted-foreground">
                            {new Date(source.source_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <a
                        href={source.canonical_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0"
                      >
                        <Button variant="ghost" size="icon">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
