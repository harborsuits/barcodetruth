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
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center p-4">
        <Card className="max-w-3xl w-full p-8">
          <div className="text-center mb-8">
            <img src={logo} alt="BarcodeTruth" className="h-16 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Welcome to BarcodeTruth! 👋</h1>
            <p className="text-lg text-muted-foreground">
              Shop according to YOUR values, not generic ratings
            </p>
          </div>

          {/* How It Works Section */}
          <div className="bg-primary/5 rounded-lg p-6 mb-6 border-2 border-primary/20">
            <h2 className="text-xl font-bold mb-4 text-center">How It Works</h2>
            
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">1</div>
                <div>
                  <h3 className="font-semibold mb-1">You Set Your Values (Next Step)</h3>
                  <p className="text-sm text-muted-foreground">
                    Tell us what matters to YOU on a 0-100 scale for 4 categories:
                    Labor, Environment, Politics, and Social Issues.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">2</div>
                <div>
                  <h3 className="font-semibold mb-1">We Calculate Your Match</h3>
                  <p className="text-sm text-muted-foreground">
                    When you scan a product, we compare the brand's actual scores 
                    (based on real news) against YOUR values to calculate a match percentage.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">3</div>
                <div>
                  <h3 className="font-semibold mb-1">You Make Better Choices</h3>
                  <p className="text-sm text-muted-foreground">
                    See if a brand aligns with your values, read the evidence, 
                    and find alternatives if it doesn't match.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Example Section */}
          <div className="bg-muted rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-2 text-center">Example</h3>
            <div className="text-sm space-y-2">
              <p>
                <span className="font-medium">You set Labor to 90</span> (you deeply care about worker rights)
              </p>
              <p>
                <span className="font-medium">You scan Brand X</span> → They have Labor score of 35 (many violations)
              </p>
              <p>
                <span className="font-medium">Result:</span> <span className="text-destructive font-bold">45% Match - Major Mismatch</span>
              </p>
              <p>
                <span className="font-medium">We suggest alternatives</span> with better labor practices
              </p>
            </div>
          </div>

          <Button 
            size="lg" 
            className="w-full"
            onClick={() => setStep(1)}
          >
            Set My Values →
          </Button>

          <p className="text-xs text-center text-muted-foreground mt-4">
            Takes 2 minutes • Can be changed anytime in Settings
          </p>
        </Card>
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


