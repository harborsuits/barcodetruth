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
import { HowItWorks } from "@/components/landing/HowItWorks";

interface ValueCardProps {
  icon: React.ReactNode;
  title: string;
  color: 'blue' | 'green' | 'purple' | 'pink';
  value: number;
  onChange: (value: number) => void;
  shortDesc: string;
  examples: {
    low: string;
    mid: string;
    high: string;
  };
  scaleLabels?: {
    left: string;
    right: string;
  };
}

const ValueCard = ({
  icon,
  title,
  color,
  value,
  onChange,
  shortDesc,
  examples,
  scaleLabels = { left: "Don't care", right: "Very important" }
}: ValueCardProps) => {
  const [isActive, setIsActive] = useState(false);
  
  const colorMap = {
    blue: {
      bg: 'bg-labor',
      light: 'bg-labor/10',
      border: 'border-labor/30',
      text: 'text-labor',
    },
    green: {
      bg: 'bg-environment',
      light: 'bg-environment/10',
      border: 'border-environment/30',
      text: 'text-environment',
    },
    purple: {
      bg: 'bg-politics',
      light: 'bg-politics/10',
      border: 'border-politics/30',
      text: 'text-politics',
    },
    pink: {
      bg: 'bg-social',
      light: 'bg-social/10',
      border: 'border-social/30',
      text: 'text-social',
    }
  };

  const colors = colorMap[color];

  // Determine which example to show
  const getCurrentExample = () => {
    if (value < 35) return examples.low;
    if (value < 65) return examples.mid;
    return examples.high;
  };

  // Determine intensity
  const getIntensity = () => {
    if (value < 35) return { label: "Low Priority", emoji: "😌" };
    if (value < 65) return { label: "Moderate", emoji: "🤔" };
    return { label: "High Priority", emoji: "🔥" };
  };

  const intensity = getIntensity();

  return (
    <div
      className={`
        bg-card rounded-2xl p-6 shadow-lg border-2 transition-all duration-300
        ${isActive ? `${colors.border} scale-[1.02]` : 'border-border'}
      `}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center text-white shadow-md`}>
            {icon}
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{shortDesc}</p>
          </div>
        </div>
        
        {/* Live Value Display */}
        <div className="text-right">
          <div className={`text-3xl font-bold ${colors.text}`}>{value}</div>
          <div className="text-xs text-muted-foreground">/100</div>
        </div>
      </div>

      {/* Slider */}
      <div className="mb-4">
        <Slider
          value={[value]}
          onValueChange={(vals) => onChange(vals[0])}
          min={0}
          max={100}
          step={5}
          onPointerDown={() => setIsActive(true)}
          onPointerUp={() => setIsActive(false)}
          className="mb-2"
        />
        
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{scaleLabels.left} (0)</span>
          <span>{scaleLabels.right} (100)</span>
        </div>
      </div>

      {/* Live Feedback */}
      <div className={`${colors.light} rounded-xl p-4 border ${colors.border}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{intensity.emoji}</span>
          <span className={`font-semibold text-sm ${colors.text}`}>
            {intensity.label}
          </span>
        </div>
        <p className="text-sm text-foreground/80 italic">
          "{getCurrentExample()}"
        </p>
      </div>
    </div>
  );
};

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

  // Check authentication using onAuthStateChange to handle OAuth redirects properly
  useEffect(() => {
    let mounted = true;

    const checkOnboardingStatus = async (userId: string) => {
      // Check onboarding status from database
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.onboarding_complete) {
        navigate("/");
        return true;
      }

      // Fallback: if user has saved preferences, consider onboarding complete
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (prefs) {
        await supabase.from('profiles').upsert({ id: userId, onboarding_complete: true });
        navigate("/");
        return true;
      }

      return false;
    };

    // Set up auth state listener FIRST to catch OAuth callbacks
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        if (!session?.user) {
          // Only redirect to auth if explicitly signed out
          if (event === 'SIGNED_OUT') {
            navigate("/auth");
          }
          return;
        }

        // User is authenticated - check onboarding status with setTimeout to avoid deadlock
        setTimeout(async () => {
          if (!mounted) return;
          const alreadyOnboarded = await checkOnboardingStatus(session.user.id);
          if (!alreadyOnboarded && mounted) {
            setIsAuthenticated(true);
          }
        }, 0);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;

      if (!session?.user) {
        // No session - redirect to auth
        toast({
          title: "Authentication required",
          description: "Please sign in to continue",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      // Check onboarding status
      const alreadyOnboarded = await checkOnboardingStatus(session.user.id);
      if (!alreadyOnboarded && mounted) {
        setIsAuthenticated(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, toast]);

  const handleComplete = async () => {
    setLoading(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("No user found");
      }

      // Save values to database
      const success = await updateUserValues({
        value_labor: values.labor,
        value_environment: values.environment,
        value_politics: values.politics,
        value_social: values.social,
      });

      if (!success) {
        throw new Error("Failed to save preferences");
      }

      // Mark onboarding complete in database
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, onboarding_complete: true });

      if (profileError) {
        throw profileError;
      }

      // Also update localStorage as cache
      localStorage.setItem("onboardingComplete", "true");
      localStorage.setItem("userValues", JSON.stringify(values));
      sessionStorage.setItem("justCompletedOnboarding", "true");
      
      toast({
        title: "Preferences saved",
        description: "Your values have been saved successfully",
      });
      
      navigate("/");
    } catch (error) {
      console.error("Error completing onboarding:", error);
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
      <div className="min-h-screen bg-background relative overflow-hidden p-4 flex items-center justify-center">
        {/* Subtle barcode watermark */}
        <div className="absolute bottom-8 right-8 opacity-[0.03] pointer-events-none">
          <svg width="200" height="120" viewBox="0 0 200 120" fill="currentColor" className="text-foreground">
            <rect x="0" y="0" width="4" height="120"/>
            <rect x="8" y="0" width="2" height="120"/>
            <rect x="14" y="0" width="6" height="120"/>
            <rect x="24" y="0" width="2" height="120"/>
            <rect x="30" y="0" width="4" height="120"/>
            <rect x="38" y="0" width="2" height="120"/>
            <rect x="44" y="0" width="8" height="120"/>
            <rect x="56" y="0" width="2" height="120"/>
            <rect x="62" y="0" width="4" height="120"/>
            <rect x="70" y="0" width="6" height="120"/>
            <rect x="80" y="0" width="2" height="120"/>
          </svg>
        </div>

        <div className="max-w-4xl w-full mx-auto">
          {/* Hero Section with gradient overlay */}
          <div className="relative text-center mb-10 pb-8">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-accent/5 to-transparent rounded-3xl -z-10"></div>
            
            {/* Logo with scanline animation */}
            <div className="relative inline-block mb-6 pt-8">
              <img src={logo} alt="BarcodeTruth" className="h-24 mx-auto relative z-10" />
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse"></div>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
              Welcome to BarcodeTruth
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground font-medium max-w-2xl mx-auto">
              Shop according to YOUR values, not generic ratings
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Evidence-based brand transparency
            </p>
          </div>

          {/* Pillar Cards - How It Works */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <Card className="p-6 animate-fade-in" style={{animationDelay: '0ms'}}>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Heart className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-foreground mb-2">Choose What Matters</h3>
              <p className="text-sm text-muted-foreground">
                Set your priorities: labor rights, environment, social values, or politics
              </p>
            </Card>

            <Card className="p-6 animate-fade-in" style={{animationDelay: '100ms'}}>
              <div className="w-12 h-12 rounded-xl bg-environment/10 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-environment" />
              </div>
              <h3 className="font-bold text-foreground mb-2">Find Brands</h3>
              <p className="text-sm text-muted-foreground">
                Scan any product to see how the brand aligns with your values
              </p>
            </Card>

            <Card className="p-6 animate-fade-in" style={{animationDelay: '200ms'}}>
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                <Info className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-bold text-foreground mb-2">See Alignment</h3>
              <p className="text-sm text-muted-foreground">
                Get personalized scores showing matches and mismatches
              </p>
            </Card>
          </div>

          {/* Example Cards */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <Card className="p-5 border-2 border-success/30 bg-success/5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-foreground">Good Match</h4>
                <div className="px-3 py-1 rounded-full bg-success/20 text-success font-bold text-sm">87% Match</div>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                When a brand's labor practices (85) align with your values (90)
              </p>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full" style={{width: '87%'}}></div>
              </div>
            </Card>

            <Card className="p-5 border-2 border-danger/30 bg-danger/5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-foreground">Mismatch</h4>
                <div className="px-3 py-1 rounded-full bg-danger/20 text-danger font-bold text-sm">28% Match</div>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                When a brand's environment score (20) conflicts with your priority (85)
              </p>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-danger rounded-full" style={{width: '28%'}}></div>
              </div>
            </Card>
          </div>

          {/* Why This Matters - InfoAlert Style */}
          <div className="space-y-3 mb-8">
            <div className="flex gap-4 items-start p-4 bg-card rounded-xl border border-border">
              <div className="text-2xl">🧠</div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Personal, Not Political</h4>
                <p className="text-sm text-muted-foreground">Your values shape scores—what matters to you drives what you see</p>
              </div>
            </div>
            
            <div className="flex gap-4 items-start p-4 bg-card rounded-xl border border-border">
              <div className="text-2xl">⚖️</div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Evidence-Based</h4>
                <p className="text-sm text-muted-foreground">Every score backed by real news, verified sources, and transparent data</p>
              </div>
            </div>
            
            <div className="flex gap-4 items-start p-4 bg-card rounded-xl border border-border">
              <div className="text-2xl">🔍</div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Shop Smarter</h4>
                <p className="text-sm text-muted-foreground">Make informed choices—discover better alternatives that match your priorities</p>
              </div>
            </div>
          </div>

          {/* CTA Section with gradient button and step indicator */}
          <div className="text-center bg-card/50 backdrop-blur-sm rounded-2xl p-6 border border-border/50">
            <div className="text-xs text-muted-foreground mb-3 font-medium">STEP 1 OF 2</div>
            
            <Button 
              size="lg"
              onClick={() => setStep(1)}
              className="bg-gradient-to-r from-success to-primary hover:from-success/90 hover:to-primary/90 text-white font-bold text-lg px-10 py-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 mb-3"
            >
              Set My Values →
            </Button>
            
            <p className="text-muted-foreground text-sm mb-4">
              Takes 2 minutes • Can be changed anytime in Settings
            </p>

            {/* Trust chips with fade-in */}
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              <div className="flex items-center gap-2 px-3 py-1 bg-background rounded-full border border-border animate-fade-in" style={{animationDelay: '300ms'}}>
                <div className="w-1.5 h-1.5 bg-success rounded-full"></div>
                <span className="text-muted-foreground">Non-partisan</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-background rounded-full border border-border animate-fade-in" style={{animationDelay: '400ms'}}>
                <div className="w-1.5 h-1.5 bg-success rounded-full"></div>
                <span className="text-muted-foreground">Evidence-based</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-background rounded-full border border-border animate-fade-in" style={{animationDelay: '500ms'}}>
                <div className="w-1.5 h-1.5 bg-success rounded-full"></div>
                <span className="text-muted-foreground">Private</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 1) {
    // Calculate overall profile
    const getProfile = () => {
      const avg = (values.labor + values.environment + values.politics + values.social) / 4;
      if (avg >= 70) return { label: "Highly Values-Driven", color: "text-primary" };
      if (avg >= 40) return { label: "Balanced Approach", color: "text-foreground" };
      return { label: "Focused on Specific Issues", color: "text-accent" };
    };

    const profile = getProfile();

    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="max-w-4xl w-full">
          {/* Header with live feedback */}
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold mb-2 text-foreground">
              What matters to you?
            </h1>
            <p className="text-muted-foreground mb-4">
              Set your values on a 0-100 scale. Higher = more important to you.
            </p>
            
            {/* Live Profile Indicator */}
            <div className="inline-block bg-card rounded-full px-6 py-2 shadow-md border border-border">
              <span className="text-sm text-muted-foreground mr-2">Your Profile:</span>
              <span className={`font-bold ${profile.color}`}>{profile.label}</span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Labor Card */}
            <ValueCard
              icon={<Users className="w-6 h-6" />}
              title="Worker Rights & Labor"
              color="blue"
              value={values.labor}
              onChange={(v) => setValues({ ...values, labor: v })}
              shortDesc="How companies treat their workers"
              examples={{
                low: "I don't factor this into shopping decisions",
                mid: "I consider it, but it's not a dealbreaker",
                high: "I actively avoid companies with poor labor records"
              }}
            />

            {/* Environment Card */}
            <ValueCard
              icon={<Leaf className="w-6 h-6" />}
              title="Environmental Impact"
              color="green"
              value={values.environment}
              onChange={(v) => setValues({ ...values, environment: v })}
              shortDesc="Climate change and sustainability"
              examples={{
                low: "Environmental impact doesn't affect my choices",
                mid: "I prefer eco-friendly when convenient",
                high: "I prioritize sustainability and avoid polluters"
              }}
            />

            {/* Politics Card */}
            <ValueCard
              icon={<Megaphone className="w-6 h-6" />}
              title="Political Influence"
              color="purple"
              value={values.politics}
              onChange={(v) => setValues({ ...values, politics: v })}
              shortDesc="Corporate lobbying and donations"
              examples={{
                low: "I don't care about corporate political spending",
                mid: "I'm curious but it doesn't change my shopping",
                high: "I want to know where my money goes politically"
              }}
            />

            {/* Social Card */}
            <ValueCard
              icon={<Heart className="w-6 h-6" />}
              title="Social Values"
              color="pink"
              value={values.social}
              onChange={(v) => setValues({ ...values, social: v })}
              shortDesc="Diversity, inclusion & social justice"
              examples={{
                low: "I prefer traditional companies",
                mid: "I'm neutral on DEI initiatives",
                high: "I support diverse, inclusive companies"
              }}
              scaleLabels={{
                left: "Traditional",
                right: "Progressive"
              }}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-8">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setStep(0)}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              size="lg"
              onClick={handleComplete}
              className="flex-1 bg-primary hover:bg-primary/90"
              disabled={loading}
            >
              {loading ? "Saving..." : "Continue →"}
            </Button>
          </div>

          {/* Quick Set Options */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">Not sure where to start?</p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setValues({ labor: 20, environment: 20, politics: 20, social: 20 })}
                className="text-xs"
              >
                🎯 Price Focused (20s)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setValues({ labor: 50, environment: 50, politics: 50, social: 50 })}
                className="text-xs"
              >
                ⚖️ Balanced (50s)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setValues({ labor: 85, environment: 85, politics: 85, social: 85 })}
                className="text-xs"
              >
                💚 Highly Conscious (85s)
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};


