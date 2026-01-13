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
    // Set up auth state listener FIRST - this catches OAuth redirects
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Update user state synchronously
        setUser(session?.user ?? null);
        
        // If no session after state change settles, redirect to auth
        if (!session?.user) {
          navigate("/auth");
          return;
        }
        
        // Check onboarding if required (deferred to avoid deadlock)
        if (requireOnboarding) {
          setTimeout(() => {
            const onboardingComplete = localStorage.getItem("onboardingComplete");
            if (!onboardingComplete) {
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        
        if (requireOnboarding) {
          const onboardingComplete = localStorage.getItem("onboardingComplete");
          if (!onboardingComplete) {
            navigate("/onboarding");
          } else {
            setIsChecking(false);
          }
        } else {
          setIsChecking(false);
        }
      }
      // Don't redirect immediately - wait for onAuthStateChange to handle no-session case
    });

    return () => subscription.unsubscribe();
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
