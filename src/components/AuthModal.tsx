import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Loader2, X } from "lucide-react";

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Signup preferences
  const [ageRange, setAgeRange] = useState("");
  const [location, setLocation] = useState("");
  const [prefLabor, setPrefLabor] = useState(false);
  const [prefEnvironment, setPrefEnvironment] = useState(false);
  const [prefPolitics, setPrefPolitics] = useState(false);
  const [prefSocial, setPrefSocial] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        // Create user profile with preferences
        if (data.user) {
          const { error: profileError } = await supabase
            .from('user_profiles')
            .insert({
              user_id: data.user.id,
              age_range: ageRange || null,
              location: location || null,
              pref_labor: prefLabor,
              pref_environment: prefEnvironment,
              pref_politics: prefPolitics,
              pref_social: prefSocial,
            });

          if (profileError) {
            console.error('Profile creation error:', profileError);
          }
        }

        toast({
          title: "Account created!",
          description: "You can now start scanning products",
        });
        
        onSuccess();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Welcome back!",
          description: "You're now signed in",
        });
        
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">
            {mode === 'signup' ? 'Create Account' : 'Sign In'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <p className="text-gray-600 mb-6">
          {mode === 'signup' 
            ? 'Create a free account to start scanning products and tracking brands.'
            : 'Sign in to continue scanning and view your history.'}
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>

          {mode === 'signup' && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium text-sm">Personalize Your Experience (Optional)</h3>
              
              <div className="space-y-2">
                <Label htmlFor="age_range">Age Range</Label>
                <select 
                  id="age_range"
                  value={ageRange}
                  onChange={(e) => setAgeRange(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  disabled={isLoading}
                >
                  <option value="">Prefer not to say</option>
                  <option value="18-24">18-24</option>
                  <option value="25-34">25-34</option>
                  <option value="35-44">35-44</option>
                  <option value="45-54">45-54</option>
                  <option value="55+">55+</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  type="text"
                  placeholder="City, State"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2">
                <Label>What matters most to you?</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="pref_labor"
                      checked={prefLabor}
                      onCheckedChange={(checked) => setPrefLabor(checked as boolean)}
                      disabled={isLoading}
                    />
                    <label htmlFor="pref_labor" className="text-sm cursor-pointer">
                      Labor & Worker Rights
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="pref_environment"
                      checked={prefEnvironment}
                      onCheckedChange={(checked) => setPrefEnvironment(checked as boolean)}
                      disabled={isLoading}
                    />
                    <label htmlFor="pref_environment" className="text-sm cursor-pointer">
                      Environmental Impact
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="pref_politics"
                      checked={prefPolitics}
                      onCheckedChange={(checked) => setPrefPolitics(checked as boolean)}
                      disabled={isLoading}
                    />
                    <label htmlFor="pref_politics" className="text-sm cursor-pointer">
                      Political Influence
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="pref_social"
                      checked={prefSocial}
                      onCheckedChange={(checked) => setPrefSocial(checked as boolean)}
                      disabled={isLoading}
                    />
                    <label htmlFor="pref_social" className="text-sm cursor-pointer">
                      Social Responsibility
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'signup' ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          <button
            type="button"
            onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
            className="text-blue-600 hover:underline"
            disabled={isLoading}
          >
            {mode === 'signup'
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
