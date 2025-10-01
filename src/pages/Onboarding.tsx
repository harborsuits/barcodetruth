import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ShoppingBag, Heart, Leaf, Users, Megaphone, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({
    labor: 50,
    environment: 50,
    politics: 50,
    social: 50,
  });

  const handleComplete = () => {
    localStorage.setItem("onboardingComplete", "true");
    localStorage.setItem("userValues", JSON.stringify(values));
    navigate("/");
  };

  if (step === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary">
              <ShoppingBag className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">ShopSignals</h1>
            <p className="text-lg text-muted-foreground">
              Shop according to your values. Discover brands that align with what matters to you.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 py-8">
            <Card>
              <CardContent className="pt-6 pb-4 space-y-2">
                <Users className="h-6 w-6 mx-auto text-labor" />
                <p className="text-sm font-medium">Labor Practices</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 pb-4 space-y-2">
                <Leaf className="h-6 w-6 mx-auto text-environment" />
                <p className="text-sm font-medium">Environment</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 pb-4 space-y-2">
                <Megaphone className="h-6 w-6 mx-auto text-politics" />
                <p className="text-sm font-medium">Political Giving</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 pb-4 space-y-2">
                <Heart className="h-6 w-6 mx-auto text-social" />
                <p className="text-sm font-medium">Community & Culture</p>
              </CardContent>
            </Card>
          </div>

          <Button onClick={() => setStep(1)} size="lg" className="w-full">
            Get Started
          </Button>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center">
            <h2 className="text-3xl font-bold">What matters to you?</h2>
            <p className="text-muted-foreground">
              Adjust these sliders to reflect your priorities. You can change these anytime in settings.
            </p>
          </div>

          <TooltipProvider>
          <div className="space-y-8">
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
          </div>
          </TooltipProvider>

          <div className="flex gap-3">
            <Button onClick={() => setStep(0)} variant="outline" className="flex-1">
              Back
            </Button>
            <Button onClick={handleComplete} className="flex-1">
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Onboarding;
