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
      bg: 'from-blue-500 to-blue-600',
      light: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-600',
    },
    green: {
      bg: 'from-green-500 to-green-600',
      light: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-600',
    },
    purple: {
      bg: 'from-purple-500 to-purple-600',
      light: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-600',
    },
    pink: {
      bg: 'from-pink-500 to-pink-600',
      light: 'bg-pink-50',
      border: 'border-pink-200',
      text: 'text-pink-600',
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
        bg-white rounded-2xl p-6 shadow-lg border-2 transition-all duration-300
        ${isActive ? `${colors.border} scale-[1.02]` : 'border-gray-200'}
      `}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors.bg} flex items-center justify-center text-white shadow-md`}>
            {icon}
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{shortDesc}</p>
          </div>
        </div>
        
        {/* Live Value Display */}
        <div className="text-right">
          <div className={`text-3xl font-bold ${colors.text}`}>{value}</div>
          <div className="text-xs text-gray-500">/100</div>
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
        
        <div className="flex justify-between text-xs text-gray-500">
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
        <p className="text-sm text-gray-700 italic">
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
        // Check if onboarding is already complete in database
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('id', user.id)
          .single();
        
        if (profile?.onboarding_complete) {
          // User already completed onboarding, redirect to home
          navigate("/");
        } else {
          setIsAuthenticated(true);
        }
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
        .update({ onboarding_complete: true })
        .eq('id', user.id);

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
    // Calculate overall profile
    const getProfile = () => {
      const avg = (values.labor + values.environment + values.politics + values.social) / 4;
      if (avg >= 70) return { label: "Highly Values-Driven", color: "text-blue-600" };
      if (avg >= 40) return { label: "Balanced Approach", color: "text-gray-600" };
      return { label: "Focused on Specific Issues", color: "text-purple-600" };
    };

    const profile = getProfile();

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 flex items-center justify-center">
        <div className="max-w-4xl w-full">
          {/* Header with live feedback */}
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              What matters to you?
            </h1>
            <p className="text-gray-600 mb-4">
              Set your values on a 0-100 scale. Higher = more important to you.
            </p>
            
            {/* Live Profile Indicator */}
            <div className="inline-block bg-white rounded-full px-6 py-2 shadow-md border border-gray-200">
              <span className="text-sm text-gray-500 mr-2">Your Profile:</span>
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
              className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
              disabled={loading}
            >
              {loading ? "Saving..." : "Continue →"}
            </Button>
          </div>

          {/* Quick Set Options */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 mb-3">Not sure where to start?</p>
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


