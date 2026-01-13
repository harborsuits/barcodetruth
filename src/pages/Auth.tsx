import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { Separator } from "@/components/ui/separator";

const authSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address" }).max(255),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(100),
});

export default function Auth() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Check for existing session (handles OAuth redirects)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          // User is authenticated, check onboarding and redirect
          setTimeout(() => {
            const onboardingComplete = localStorage.getItem("onboardingComplete");
            if (onboardingComplete) {
              navigate("/", { replace: true });
            } else {
              navigate("/onboarding", { replace: true });
            }
          }, 0);
        } else {
          setIsCheckingSession(false);
        }
      }
    );

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const onboardingComplete = localStorage.getItem("onboardingComplete");
        if (onboardingComplete) {
          navigate("/", { replace: true });
        } else {
          navigate("/onboarding", { replace: true });
        }
      } else {
        setIsCheckingSession(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/onboarding`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      });
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate input
      const validation = authSchema.safeParse({ email: email.trim(), password });
      if (!validation.success) {
        const firstError = validation.error.issues[0];
        toast({
          title: "Invalid input",
          description: firstError.message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (isSignUp) {
        // Validate password confirmation
        if (password !== confirmPassword) {
          toast({
            title: "Passwords don't match",
            description: "Please make sure both passwords are identical",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // Check if user already exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', (await supabase.auth.getUser()).data.user?.id)
          .maybeSingle();

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
          },
        });

        if (error) {
          // Handle specific error cases
          if (error.message.includes('already registered') || error.message.includes('already exists')) {
            toast({
              title: "Account already exists",
              description: "This email is already registered. Please sign in instead.",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
          throw error;
        }

        // Check if user already exists (Supabase returns user but with empty identities)
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          toast({
            title: "Account already exists",
            description: "This email is already registered. Please sign in instead.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // If email confirmation is disabled (auto-confirm), redirect to onboarding
        if (data.user && data.session) {
          toast({
            title: "Account created!",
            description: "Let's set up your preferences",
          });
          navigate("/onboarding");
        } else {
          toast({
            title: "Check your email",
            description: "We sent you a confirmation link",
          });
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          // Handle specific sign-in errors
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: "Invalid credentials",
              description: "Email or password is incorrect. Please try again.",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
          throw error;
        }

        // Check if onboarding is complete in database (handle missing rows)
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('id', data.user.id)
          .maybeSingle();
        
        if (!profile?.onboarding_complete) {
          // Fallback: if user has saved preferences already, mark complete and continue
          const { data: prefs } = await supabase
            .from('user_preferences')
            .select('user_id')
            .eq('user_id', data.user.id)
            .maybeSingle();

          if (prefs) {
            await supabase
              .from('profiles')
              .upsert({ id: data.user.id, onboarding_complete: true });
            localStorage.setItem("onboardingComplete", "true");
            toast({ title: "Welcome back!", description: "You're all set." });
            navigate("/");
          } else {
            toast({
              title: "Welcome back!",
              description: "Let's complete your profile setup",
            });
            navigate("/onboarding");
          }
        } else {
          // Update localStorage cache
          localStorage.setItem("onboardingComplete", "true");
          toast({
            title: "Welcome back!",
            description: "You've successfully signed in",
          });
          navigate("/");
        }
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

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            {isSignUp ? "Create an account" : "Welcome back"}
          </CardTitle>
          <CardDescription>
            {isSignUp
              ? "Enter your email to create your account"
              : "Enter your email to sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? "Sign up" : "Sign in"}
            </Button>
          </form>

          <div className="relative my-4">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              or continue with
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
          >
            {isGoogleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Continue with Google
          </Button>

          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary hover:underline"
              disabled={isLoading}
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
