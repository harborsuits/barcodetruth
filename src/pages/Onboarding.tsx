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
        // Check onboarding status from database; handle missing profile rows (pre-migration users)
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.onboarding_complete) {
          navigate("/");
          return;
        }

        // Fallback: if user has saved preferences, consider onboarding complete
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (prefs) {
          await supabase.from('profiles').upsert({ id: user.id, onboarding_complete: true });
          navigate("/");
          return;
        }

        setIsAuthenticated(true);
      }
    };
    checkAuth();
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
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-accent p-4 flex items-center justify-center">
        <div className="max-w-4xl w-full animate-fade-in">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="inline-block bg-card/10 backdrop-blur-sm rounded-2xl p-4 mb-4">
              <img src={logo} alt="BarcodeTruth" className="h-20 mx-auto" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-primary-foreground mb-4 drop-shadow-lg">
              Welcome to BarcodeTruth! 👋
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/90 font-medium">
              Shop according to YOUR values, not generic ratings
            </p>
          </div>

          {/* How It Works - Use new component */}
          <div className="bg-card/95 backdrop-blur-lg rounded-3xl shadow-2xl mb-6 p-4">
            <HowItWorks />
          </div>

          {/* CTA Button - Make it HUGE and impossible to miss */}
          <div className="text-center">
            <Button 
              size="lg"
              onClick={() => setStep(1)}
              className="bg-success hover:bg-success/90 text-white font-bold text-xl px-12 py-8 rounded-2xl shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-200"
            >
              Set My Values →
            </Button>
            
            <p className="text-primary-foreground/80 text-sm mt-4 font-medium">
              Takes 2 minutes • Can be changed anytime in Settings
            </p>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-8 mt-8 text-primary-foreground/70 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <span>Non-partisan</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <span>Evidence-based</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <span>5 free scans</span>
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


