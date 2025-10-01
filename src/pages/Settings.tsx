import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Leaf, Megaphone, Heart, Info, Bell } from "lucide-react";
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

export const Settings = () => {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    labor: 50,
    environment: 50,
    politics: 50,
    social: 50,
  });
  const [nuanceMode, setNuanceMode] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [checkingPush, setCheckingPush] = useState(true);
  const [mutedCategories, setMutedCategories] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("userValues");
    if (saved) {
      setValues(JSON.parse(saved));
    }
    
    // Check if push is already subscribed
    isPushSubscribed().then(subscribed => {
      setPushEnabled(subscribed);
      setCheckingPush(false);
    });

    // Load muted categories from user preferences
    const loadPreferences = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('user_preferences')
          .select('muted_categories')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (data?.muted_categories) {
          setMutedCategories(data.muted_categories);
        }
      }
    };
    loadPreferences();
  }, []);

  const handleSave = async () => {
    localStorage.setItem("userValues", JSON.stringify(values));
    
    // Save muted categories to user preferences
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          muted_categories: mutedCategories,
        });
    }
    
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Settings</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        <TooltipProvider>
        <Card>
          <CardHeader>
            <CardTitle>Your Values</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-labor" />
                  <span className="font-medium">Labor Practices</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">How the company treats workers, including wages, rights, and workplace safety.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="text-sm text-muted-foreground">{values.labor}%</span>
              </div>
              <Slider
                value={[values.labor]}
                onValueChange={(v) => setValues({ ...values, labor: v[0] })}
                max={100}
                step={1}
                className="[&_[role=slider]]:bg-labor"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Leaf className="h-5 w-5 text-environment" />
                  <span className="font-medium">Environment</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Impact on the planet, including emissions, waste, and sustainability practices.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="text-sm text-muted-foreground">{values.environment}%</span>
              </div>
              <Slider
                value={[values.environment]}
                onValueChange={(v) => setValues({ ...values, environment: v[0] })}
                max={100}
                step={1}
                className="[&_[role=slider]]:bg-environment"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-politics" />
                  <span className="font-medium">Political Giving</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Donations and lobbying by the company and its leaders.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="text-sm text-muted-foreground">{values.politics}%</span>
              </div>
              <Slider
                value={[values.politics]}
                onValueChange={(v) => setValues({ ...values, politics: v[0] })}
                max={100}
                step={1}
                className="[&_[role=slider]]:bg-politics"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-social" />
                  <span className="font-medium">Community & Culture</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">The company's effect on society, such as inclusion, equity, and community impact.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="text-sm text-muted-foreground">{values.social}%</span>
              </div>
              <Slider
                value={[values.social]}
                onValueChange={(v) => setValues({ ...values, social: v[0] })}
                max={100}
                step={1}
                className="[&_[role=slider]]:bg-social"
              />
            </div>
          </CardContent>
        </Card>
        </TooltipProvider>

        <Card>
          <CardHeader>
            <CardTitle>Display Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="nuance-mode">Nuance Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Show both positive and negative signals
                </p>
              </div>
              <Switch
                id="nuance-mode"
                checked={nuanceMode}
                onCheckedChange={setNuanceMode}
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
                  Get notified when brand scores change significantly. Up to 2 alerts per brand per day. No notifications between 10pm–7am UTC.
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
                  <p className="text-xs text-muted-foreground">
                    Note: Actual push sending is stubbed. Subscription flow and UI are fully functional.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="w-full" size="lg">
          Save Changes
        </Button>
      </main>
    </div>
  );
};


