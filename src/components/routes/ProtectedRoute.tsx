import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

export const ProtectedRoute = ({ children, requireOnboarding = true }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;

    // Check onboarding status from database
    const checkOnboardingStatus = async (userId: string): Promise<boolean> => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.onboarding_complete) {
        localStorage.setItem("onboardingComplete", "true");
        return true;
      }

      // Fallback: check if user has preferences saved
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (prefs) {
        await supabase.from('profiles').upsert({ id: userId, onboarding_complete: true });
        localStorage.setItem("onboardingComplete", "true");
        return true;
      }

      return false;
    };

    // Set up auth state listener FIRST - this catches OAuth redirects
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        // Update user state synchronously
        setUser(session?.user ?? null);
        
        // Only redirect to auth on explicit SIGNED_OUT - NOT when session is temporarily null during OAuth
        if (!session?.user) {
          if (event === 'SIGNED_OUT') {
            navigate("/auth");
          }
          return;
        }
        
        // Check onboarding if required (deferred to avoid deadlock)
        if (requireOnboarding) {
          setTimeout(async () => {
            if (!mounted) return;
            const isComplete = await checkOnboardingStatus(session.user.id);
            if (!isComplete) {
              navigate("/onboarding");
            } else {
              setIsChecking(false);
            }
          }, 0);
        } else {
          setIsChecking(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;

      if (session?.user) {
        setUser(session.user);
        
        if (requireOnboarding) {
          const isComplete = await checkOnboardingStatus(session.user.id);
          if (!isComplete) {
            navigate("/onboarding");
          } else {
            setIsChecking(false);
          }
        } else {
          setIsChecking(false);
        }
      } else {
        // No session - redirect to auth
        navigate("/auth");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, requireOnboarding]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
};
