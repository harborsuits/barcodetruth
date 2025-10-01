import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Leaf, Megaphone, Heart, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Settings = () => {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    labor: 50,
    environment: 50,
    politics: 50,
    social: 50,
  });
  const [nuanceMode, setNuanceMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("userValues");
    if (saved) {
      setValues(JSON.parse(saved));
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("userValues", JSON.stringify(values));
    navigate(-1);
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

        <Button onClick={handleSave} className="w-full" size="lg">
          Save Changes
        </Button>
      </main>
    </div>
  );
};

export default Settings;
