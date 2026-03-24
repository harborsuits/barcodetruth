import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Users, Leaf, Megaphone, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { updateUserValues } from "@/lib/userPreferences";
import { useToast } from "@/hooks/use-toast";
import { HowItWorks } from "@/components/landing/HowItWorks";

interface DimensionConfig {
  key: 'labor' | 'environment' | 'politics' | 'social';
  icon: React.ReactNode;
  title: string;
  tag: string;
  subLabels: [string, string];
}

const DIMENSIONS: DimensionConfig[] = [
  {
    key: 'labor',
    icon: <Users className="w-5 h-5" />,
    title: 'Worker Rights',
    tag: 'LABOR_STANDARDS_INDEX',
    subLabels: ['COMPLIANCE_WEIGHT', 'CRITICAL_RATIO'],
  },
  {
    key: 'environment',
    icon: <Leaf className="w-5 h-5" />,
    title: 'Environment',
    tag: 'ENVIRONMENTAL_IMPACT_INDEX',
    subLabels: ['SUSTAINABILITY_WEIGHT', 'EMISSIONS_RATIO'],
  },
  {
    key: 'politics',
    icon: <Megaphone className="w-5 h-5" />,
    title: 'Political',
    tag: 'POLITICAL_INFLUENCE_INDEX',
    subLabels: ['LOBBYING_WEIGHT', 'DONATION_RATIO'],
  },
  {
    key: 'social',
    icon: <Heart className="w-5 h-5" />,
    title: 'Social',
    tag: 'SOCIAL_VALUES_INDEX',
    subLabels: ['INCLUSION_WEIGHT', 'COMMUNITY_RATIO'],
  },
];

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

  useEffect(() => {
    let mounted = true;

    const checkOnboardingStatus = async (userId: string) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.onboarding_complete) {
        navigate("/");
        return true;
      }

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (!session?.user) {
          if (event === 'SIGNED_OUT') navigate("/auth");
          return;
        }
        setTimeout(async () => {
          if (!mounted) return;
          const alreadyOnboarded = await checkOnboardingStatus(session.user.id);
          if (!alreadyOnboarded && mounted) setIsAuthenticated(true);
        }, 0);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (!session?.user) {
        toast({ title: "Authentication required", description: "Please sign in to continue", variant: "destructive" });
        navigate("/auth");
        return;
      }
      const alreadyOnboarded = await checkOnboardingStatus(session.user.id);
      if (!alreadyOnboarded && mounted) setIsAuthenticated(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, toast]);

  const handleComplete = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const success = await updateUserValues({
        value_labor: values.labor,
        value_environment: values.environment,
        value_politics: values.politics,
        value_social: values.social,
      });

      if (!success) throw new Error("Failed to save preferences");

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, onboarding_complete: true });

      if (profileError) throw profileError;

      localStorage.setItem("onboardingComplete", "true");
      localStorage.setItem("userValues", JSON.stringify(values));
      sessionStorage.setItem("justCompletedOnboarding", "true");
      
      toast({ title: "Preferences saved", description: "Your values have been saved successfully" });
      navigate("/");
    } catch (error) {
      console.error("Error completing onboarding:", error);
      toast({ title: "Error", description: "Failed to save preferences. Please try again.", variant: "destructive" });
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  // Step 0: Welcome / How It Works
  if (step === 0) {
    return (
      <div className="min-h-screen bg-background forensic-grid p-4 flex items-center justify-center">
        <div className="max-w-2xl w-full mx-auto space-y-8">
          {/* Forensic header */}
          <div className="text-center space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">FORENSIC_EDITORIAL</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Welcome to BarcodeTruth</h1>
            <p className="text-sm text-muted-foreground">Evidence-based brand transparency</p>
          </div>

          <HowItWorks />

          <div className="text-center space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">STEP 1 OF 2</p>
            <Button 
              size="lg"
              onClick={() => setStep(1)}
              className="font-mono text-xs uppercase tracking-wider px-10"
            >
              Configure Alignment Weights →
            </Button>
            <p className="text-xs text-muted-foreground">Takes 2 minutes · Can be changed anytime</p>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Value sliders
  return (
    <div className="min-h-screen bg-background forensic-grid p-4 flex items-center justify-center">
      <div className="max-w-2xl w-full mx-auto space-y-6">
        {/* Protocol header */}
        <div className="text-center space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary/60">WEIGHT_DISTRIBUTION_PROTOCOL</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Configure Personal Alignment Weights</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Adjust each dimension to reflect how much it matters in your purchasing decisions. Higher values = higher priority.
          </p>
        </div>

        {/* Dimension cards */}
        <div className="space-y-3">
          {DIMENSIONS.map((dim) => {
            const val = values[dim.key];
            return (
              <div key={dim.key} className="bg-elevated-1 border border-border p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      {dim.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{dim.title}</h3>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{dim.tag}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold font-mono text-primary">{val}%</div>
                  </div>
                </div>

                <Slider
                  value={[val]}
                  onValueChange={(v) => setValues({ ...values, [dim.key]: v[0] })}
                  min={0}
                  max={100}
                  step={5}
                  className="my-2"
                />

                <div className="flex justify-between">
                  {dim.subLabels.map((label) => (
                    <span key={label} className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">{label}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick presets */}
        <div className="flex justify-center gap-2">
          {[
            { label: 'MINIMAL', vals: { labor: 20, environment: 20, politics: 20, social: 20 } },
            { label: 'BALANCED', vals: { labor: 50, environment: 50, politics: 50, social: 50 } },
            { label: 'MAXIMUM', vals: { labor: 85, environment: 85, politics: 85, social: 85 } },
          ].map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={() => setValues(preset.vals)}
              className="font-mono text-[10px] uppercase tracking-wider"
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setStep(0)}
            className="flex-1 font-mono text-xs uppercase tracking-wider"
          >
            Back
          </Button>
          <Button
            size="lg"
            onClick={handleComplete}
            className="flex-1 font-mono text-xs uppercase tracking-wider"
            disabled={loading}
          >
            {loading ? "Saving..." : "FINALIZE ALIGNMENT MODEL →"}
          </Button>
        </div>

        <p className="text-[10px] text-center text-muted-foreground/50 font-mono uppercase tracking-wider">
          Analytics are anonymized · Values stored securely · Adjustable in Settings
        </p>
      </div>
    </div>
  );
};
