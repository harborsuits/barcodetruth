import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Leaf, Megaphone, Heart, Info, Bell, Crown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from "@/lib/pushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ValueSliders } from "@/components/ValueSliders";
import { updateUserValues } from "@/lib/userPreferences";

type ValuePreset = "balanced" | "worker-first" | "green-first" | "politics-light" | "custom";

export const Settings = () => {
  const navigate = useNavigate();
  const { subscribed, subscription_end, loading, startCheckout, manageSubscription } = useSubscription();
  const isAdmin = useIsAdmin();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [values, setValues] = useState({
    labor: 50,
    environment: 50,
    politics: 50,
    social: 50,
  });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [checkingPush, setCheckingPush] = useState(true);
  const [mutedCategories, setMutedCategories] = useState<string[]>([]);
  const [notificationMode, setNotificationMode] = useState<"instant" | "digest">("instant");
  const [digestTime, setDigestTime] = useState("18:00");
  const [politicalAlignment, setPoliticalAlignment] = useState<string | null>(null);
  const [excludeSameParent, setExcludeSameParent] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
      setCheckingAuth(false);
    };
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Check if push is already subscribed
    isPushSubscribed().then(subscribed => {
      setPushEnabled(subscribed);
      setCheckingPush(false);
    });

    // Load all preferences from database
    const loadPreferences = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (data) {
          // Load new value columns
          if (data.value_labor !== undefined) {
            setValues({
              labor: data.value_labor,
              environment: data.value_environment ?? 50,
              politics: data.value_politics ?? 50,
              social: data.value_social ?? 50,
            });
          }
          if (data.muted_categories) {
            setMutedCategories(data.muted_categories);
          }
          if (data.notification_mode) {
            setNotificationMode(data.notification_mode as "instant" | "digest");
          }
          if (data.political_alignment) {
            setPoliticalAlignment(data.political_alignment);
          }
          if (data.digest_time) {
            setDigestTime(data.digest_time);
          }
          if (typeof data.exclude_same_parent === 'boolean') {
            setExcludeSameParent(data.exclude_same_parent);
          }
        }
      }
    };
    loadPreferences();
  }, []);


  const handleSave = async () => {
    // Save non-value preferences to database (values are saved by ValueSliders component)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          muted_categories: mutedCategories,
          notification_mode: notificationMode,
          political_alignment: politicalAlignment,
          digest_time: digestTime,
          exclude_same_parent: excludeSameParent,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('Failed to save other settings:', error);
        toast({
          title: "Failed to save",
          description: "Please try again",
          variant: "destructive",
        });
        return;
      }
    }
    
    toast({
      title: "Settings saved",
      description: "Your notification and filter preferences have been updated",
    });
    
    navigate(-1);
  };

  const toggleCategory = (category: string) => {
    setMutedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handlePushToggle = async (enabled: boolean) => {
    setPushEnabled(enabled);
    
    if (enabled) {
      const success = await subscribeToPush();
      if (success) {
        toast({
          title: "Notifications enabled",
          description: "You'll be notified when brands you follow have score changes",
        });
      } else {
        setPushEnabled(false);
        toast({
          title: "Failed to enable notifications",
          description: "Please check your browser permissions",
          variant: "destructive",
        });
      }
    } else {
      const success = await unsubscribeFromPush();
      if (success) {
        toast({
          title: "Notifications disabled",
          description: "You won't receive score change notifications",
        });
      } else {
        setPushEnabled(true);
        toast({
          title: "Failed to disable notifications",
          variant: "destructive",
        });
      }
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;
      
      // Clear localStorage
      localStorage.clear();
      
      toast({
        title: "Logged out",
        description: "You've been successfully logged out",
      });
      
      navigate('/auth');
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      });
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {checkingAuth || loading ? (
              <p className="text-sm text-muted-foreground">Loading subscription status...</p>
            ) : !isAuthenticated ? (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="font-medium text-destructive mb-2">Authentication Required</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Please sign in to subscribe
                </p>
                <Button onClick={() => navigate('/auth')} variant="outline" className="w-full">
                  Sign In
                </Button>
              </div>
            ) : subscribed ? (
              <>
                <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                  <div>
                    <p className="font-medium">Premium Active</p>
                    <p className="text-sm text-muted-foreground">
                      {subscription_end && `Renews on ${new Date(subscription_end).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Crown className="h-6 w-6 text-primary" />
                </div>
                <Button variant="outline" onClick={manageSubscription} className="w-full">
                  Manage Subscription
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="font-medium">Upgrade to Premium</p>
                  <p className="text-sm text-muted-foreground">
                    Get unlimited brand scans for just $5/month
                  </p>
                </div>
                <Button onClick={() => startCheckout("subscription")} className="w-full gap-2">
                  <Crown className="h-4 w-4" />
                  Subscribe Now - $5/month
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              Your Values
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Set your priorities to get personalized brand scores. Adjust these sliders to control how much each category matters to you.
            </p>
          </CardHeader>
          <CardContent>
            <ValueSliders
              initialValues={{
                value_labor: values.labor,
                value_environment: values.environment,
                value_politics: values.politics,
                value_social: values.social,
              }}
              onSave={async (newValues) => {
                setValues({
                  labor: newValues.value_labor,
                  environment: newValues.value_environment,
                  politics: newValues.value_politics,
                  social: newValues.value_social,
                });
                
                const success = await updateUserValues(newValues);
                
                if (success) {
                  toast({
                    title: "Values saved",
                    description: "Your personalized scores have been recalculated",
                  });
                } else {
                  toast({
                    title: "Failed to save",
                    description: "Please try again",
                    variant: "destructive",
                  });
                }
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Political Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label className="text-sm">Contextualize political giving based on my values</Label>
            <p className="text-xs text-muted-foreground">
              When enabled, we'll frame FEC data based on your preferences
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={politicalAlignment === "progressive" ? "default" : "outline"}
                size="sm"
                onClick={() => setPoliticalAlignment("progressive")}
              >
                Progressive
              </Button>
              <Button
                variant={politicalAlignment === "conservative" ? "default" : "outline"}
                size="sm"
                onClick={() => setPoliticalAlignment("conservative")}
              >
                Conservative
              </Button>
              <Button
                variant={politicalAlignment === "moderate" ? "default" : "outline"}
                size="sm"
                onClick={() => setPoliticalAlignment("moderate")}
              >
                Moderate
              </Button>
              <Button
                variant={politicalAlignment === "neutral" ? "default" : "outline"}
                size="sm"
                onClick={() => setPoliticalAlignment("neutral")}
              >
                Just Facts
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alternatives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="exclude-parent">Hide Same-Parent Alternatives</Label>
                <p className="text-sm text-muted-foreground">
                  Don't show alternatives owned by the same parent company
                </p>
              </div>
              <Switch
                id="exclude-parent"
                checked={excludeSameParent}
                onCheckedChange={setExcludeSameParent}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <Label htmlFor="push-notifications">Score Change Alerts</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Get notified when brand scores change significantly
                </p>
              </div>
              <Switch
                id="push-notifications"
                checked={pushEnabled}
                disabled={checkingPush}
                onCheckedChange={handlePushToggle}
              />
            </div>
            
            {pushEnabled && (
              <>
                <div className="pt-3 border-t space-y-4">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Notification Mode</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={notificationMode === "instant" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNotificationMode("instant")}
                      >
                        Instant
                      </Button>
                      <Button
                        variant={notificationMode === "digest" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNotificationMode("digest")}
                      >
                        Daily Digest
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {notificationMode === "instant" 
                        ? "Up to 2 alerts per brand per day. No notifications between 10pm–7am UTC."
                        : "One daily summary of all score changes at your preferred time."}
                    </p>
                  </div>

                  {notificationMode === "digest" && (
                    <div className="space-y-2">
                      <Label htmlFor="digest-time" className="text-sm">Digest Time (UTC)</Label>
                      <input
                        id="digest-time"
                        type="time"
                        value={digestTime}
                        onChange={(e) => setDigestTime(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                  )}

                  <div>
                    <Label className="text-sm font-medium mb-3 block">Alert Topics</Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Choose which types of events you want to be notified about
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="labor-alerts"
                          checked={!mutedCategories.includes('labor')}
                          onCheckedChange={() => toggleCategory('labor')}
                        />
                        <label
                          htmlFor="labor-alerts"
                          className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                        >
                          <Users className="h-4 w-4 text-labor" />
                          Labor Practices
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="environment-alerts"
                          checked={!mutedCategories.includes('environment')}
                          onCheckedChange={() => toggleCategory('environment')}
                        />
                        <label
                          htmlFor="environment-alerts"
                          className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                        >
                          <Leaf className="h-4 w-4 text-environment" />
                          Environment
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="politics-alerts"
                          checked={!mutedCategories.includes('politics')}
                          onCheckedChange={() => toggleCategory('politics')}
                        />
                        <label
                          htmlFor="politics-alerts"
                          className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                        >
                          <Megaphone className="h-4 w-4 text-politics" />
                          Political Giving
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="social-alerts"
                          checked={!mutedCategories.includes('social')}
                          onCheckedChange={() => toggleCategory('social')}
                        />
                        <label
                          htmlFor="social-alerts"
                          className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                        >
                          <Heart className="h-4 w-4 text-social" />
                          Community & Culture
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={async () => {
                      try {
                        const res = await fetch(
                          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-test-push`,
                          {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              title: "Test notification",
                              body: "If you see this, push notifications are working! 🎉",
                              data: { brand_id: "nike" }
                            })
                          }
                        );
                        const data = await res.json();
                        if (data.success) {
                          toast({
                            title: "Test sent!",
                            description: `Check your notifications (sent to ${data.sent} device${data.sent !== 1 ? 's' : ''})`,
                          });
                        } else {
                          throw new Error(data.error || 'Failed to send');
                        }
                      } catch (error) {
                        toast({
                          title: "Test failed",
                          description: error instanceof Error ? error.message : "Could not send test notification",
                          variant: "destructive",
                        });
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    Send Test Notification
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Admin Section - Only show to admins */}
        {isAdmin && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Admin Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Access admin-only features for managing brand data and news ingestion.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={() => navigate('/admin')}
                  variant="default"
                  size="sm"
                >
                  Dashboard
                </Button>
                <Button 
                  onClick={() => navigate('/admin/events')}
                  variant="outline"
                  size="sm"
                >
                  Event Management
                </Button>
                <Button 
                  onClick={() => navigate('/admin/health')}
                  variant="outline"
                  size="sm"
                >
                  System Health
                </Button>
                <Button 
                  onClick={() => navigate('/admin/ingestion')}
                  variant="outline"
                  size="sm"
                >
                  Ingestion
                </Button>
                <Button 
                  onClick={() => navigate('/admin/triggers')}
                  variant="outline"
                  size="sm"
                >
                  Triggers
                </Button>
                <Button 
                  onClick={() => navigate('/admin/claims')}
                  variant="outline"
                  size="sm"
                >
                  Claims
                </Button>
                <Button 
                  onClick={() => navigate('/admin/review')}
                  variant="outline"
                  size="sm"
                >
                  Review Queue
                </Button>
                <Button 
                  onClick={() => navigate('/admin/evidence/new')}
                  variant="outline"
                  size="sm"
                >
                  Add Evidence
                </Button>
                <Button 
                  onClick={() => navigate('/admin/fortune-500-enrich')}
                  variant="outline"
                  size="sm"
                >
                  Fortune 500 Enrich
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive">Account</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium mb-1">Sign Out</h3>
                <p className="text-sm text-muted-foreground">
                  Log out of your account on this device
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                {loggingOut ? 'Logging out...' : 'Log Out'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="w-full" size="lg">
          Save Other Settings
        </Button>
      </main>
    </div>
  );
};


