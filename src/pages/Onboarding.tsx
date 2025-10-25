import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Heart, Leaf, Users, Megaphone, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { updateUserValues } from "@/lib/userPreferences";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

export const Onboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [values, setValues] = useState({
    labor: 50,
    environment: 50,
    politics: 50,
    social: 50,
  });

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to continue",
          variant: "destructive",
        });
        navigate("/auth");
      } else {
        setIsAuthenticated(true);
      }
    };
    checkAuth();
  }, [navigate, toast]);

  const handleComplete = async () => {
    setLoading(true);
    
    // Save to database
    const success = await updateUserValues({
      value_labor: values.labor,
      value_environment: values.environment,
      value_politics: values.politics,
      value_social: values.social,
    });

    if (success) {
      // Mark onboarding complete in localStorage
      localStorage.setItem("onboardingComplete", "true");
      localStorage.setItem("userValues", JSON.stringify(values));
      sessionStorage.setItem("justCompletedOnboarding", "true"); // Trigger welcome tour
      
      toast({
        title: "Preferences saved",
        description: "Your values have been saved successfully",
      });
      
      navigate("/");
    } else {
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  // Don't allow skipping - preferences are required
  if (!isAuthenticated) {
    return null;
  }

  if (step === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 p-4 flex items-center justify-center">
        <div className="max-w-4xl w-full animate-fade-in">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="inline-block bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4">
              <img src={logo} alt="BarcodeTruth" className="h-20 mx-auto" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
              Welcome to BarcodeTruth! 👋
            </h1>
            <p className="text-xl md:text-2xl text-white/90 font-medium">
              Shop according to YOUR values, not generic ratings
            </p>
          </div>

          {/* How It Works - Card Style */}
          <Card className="bg-white/95 backdrop-blur-lg shadow-2xl mb-6 border-0">
            <CardContent className="p-8">
              <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                How It Works
              </h2>
              
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {/* Step 1 */}
                <div className="text-center group hover-scale">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-xl transition-shadow">
                    <span className="text-3xl font-bold text-white">1</span>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 h-full">
                    <h3 className="font-bold text-lg mb-2 text-gray-900">
                      Set Your Values
                    </h3>
                    <p className="text-sm text-gray-600">
                      4 quick sliders: Labor, Environment, Politics, and Social Issues (0-100)
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="text-center group hover-scale">
                  <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-xl transition-shadow">
                    <span className="text-3xl font-bold text-white">2</span>
                  </div>
                  <div className="bg-cyan-50 rounded-xl p-4 h-full">
                    <h3 className="font-bold text-lg mb-2 text-gray-900">
                      We Calculate Match
                    </h3>
                    <p className="text-sm text-gray-600">
                      Brand scores from real news vs. YOUR values = Match %
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="text-center group hover-scale">
                  <div className="bg-gradient-to-br from-green-500 to-green-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-xl transition-shadow">
                    <span className="text-3xl font-bold text-white">3</span>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 h-full">
                    <h3 className="font-bold text-lg mb-2 text-gray-900">
                      Better Choices
                    </h3>
                    <p className="text-sm text-gray-600">
                      See alignment, read evidence, find alternatives
                    </p>
                  </div>
                </div>
              </div>

              {/* Example - Make it POP */}
              <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-2xl p-6 relative overflow-hidden">
                {/* Decorative element */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-200/20 rounded-full -mr-16 -mt-16"></div>
                
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                    EXAMPLE
                  </div>
                  <span className="text-sm text-gray-600">See how it works:</span>
                </div>

                <div className="space-y-3 relative z-10">
                  <div className="flex flex-col md:flex-row items-center gap-3">
                    <div className="bg-white rounded-lg px-4 py-2 flex-1 shadow-sm w-full">
                      <span className="text-sm text-gray-600">You set</span>
                      <div className="font-bold text-lg">Labor: 90</div>
                      <span className="text-xs text-gray-500">(deeply care about worker rights)</span>
                    </div>
                    <div className="text-2xl">→</div>
                    <div className="bg-white rounded-lg px-4 py-2 flex-1 shadow-sm w-full">
                      <span className="text-sm text-gray-600">Brand X has</span>
                      <div className="font-bold text-lg text-red-600">Labor: 35</div>
                      <span className="text-xs text-gray-500">(many violations)</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-4 shadow-lg border-2 border-red-300">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-red-600 mb-1">45% Match</div>
                      <div className="text-sm font-semibold text-red-700 mb-2">⚠️ Major Mismatch</div>
                      <div className="text-sm text-gray-600">
                        We suggest alternatives with better labor practices
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA Button - Make it HUGE and impossible to miss */}
          <div className="text-center">
            <Button 
              size="lg"
              onClick={() => setStep(1)}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold text-xl px-12 py-8 rounded-2xl shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-200"
            >
              Set My Values →
            </Button>
            
            <p className="text-white/80 text-sm mt-4 font-medium">
              Takes 2 minutes • Can be changed anytime in Settings
            </p>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-8 mt-8 text-white/70 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Non-partisan</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Evidence-based</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>5 free scans</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-8">
          <div className="space-y-2 text-center">
            <h2 className="text-3xl font-bold">What matters to you?</h2>
            <p className="text-muted-foreground">
              Set your values on a 0-100 scale. Higher = more important to you.
            </p>
          </div>

          <TooltipProvider>
          <div className="space-y-6">
            <Card className="p-4 border-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-labor" />
                    <span className="font-medium">Worker Rights & Labor Practices</span>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">How much do you care about how companies treat their workers, pay wages, and handle unions?</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-2xl font-bold text-labor">{values.labor}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  How much do you care about fair wages, working conditions, and union rights?
                </p>
                <Slider
                  value={[values.labor]}
                  onValueChange={(v) => setValues({ ...values, labor: v[0] })}
                  max={100}
                  step={1}
                  className="[&_[role=slider]]:bg-labor"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Don't prioritize (0)</span>
                  <span>Very important (100)</span>
                </div>
              </div>
            </Card>

            <Card className="p-4 border-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-environment" />
                    <span className="font-medium">Environmental Impact & Sustainability</span>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">Impact on the planet, including emissions, waste, and sustainability practices.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-2xl font-bold text-environment">{values.environment}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  How much do you care about climate change, pollution, and sustainable practices?
                </p>
                <Slider
                  value={[values.environment]}
                  onValueChange={(v) => setValues({ ...values, environment: v[0] })}
                  max={100}
                  step={1}
                  className="[&_[role=slider]]:bg-environment"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Don't prioritize (0)</span>
                  <span>Very important (100)</span>
                </div>
              </div>
            </Card>

            <Card className="p-4 border-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-politics" />
                    <span className="font-medium">Political Donations & Lobbying</span>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">How much do you care about corporate political spending, PAC donations, and lobbying?</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-2xl font-bold text-politics">{values.politics}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  How much do you care about where companies donate politically and their lobbying activities?
                </p>
                <Slider
                  value={[values.politics]}
                  onValueChange={(v) => setValues({ ...values, politics: v[0] })}
                  max={100}
                  step={1}
                  className="[&_[role=slider]]:bg-politics"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Don't care (0)</span>
                  <span>Very important (100)</span>
                </div>
              </div>
            </Card>

            <Card className="p-4 border-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-social" />
                    <span className="font-medium">Diversity, Inclusion & Social Values</span>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">Where do you stand on DEI programs, LGBTQ+ support, and social justice initiatives?</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-2xl font-bold text-social">{values.social}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  How do you feel about diversity programs, inclusion initiatives, and social justice efforts?
                </p>
                <Slider
                  value={[values.social]}
                  onValueChange={(v) => setValues({ ...values, social: v[0] })}
                  max={100}
                  step={1}
                  className="[&_[role=slider]]:bg-social"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Traditional values (0)</span>
                  <span>Progressive values (100)</span>
                </div>
              </div>
            </Card>
          </div>
          </TooltipProvider>

          <div className="flex gap-3">
            <Button onClick={() => setStep(0)} variant="outline" className="flex-1">
              Back
            </Button>
            <Button onClick={handleComplete} className="flex-1" disabled={loading}>
              {loading ? "Saving..." : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};


