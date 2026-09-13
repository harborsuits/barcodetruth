import { useEffect, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { authStepPath, safeReturnTo } from "@/lib/authReturn";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

type GateState = 'checking' | 'auth' | 'onboarding' | 'ready' | 'error';

export const ProtectedRoute = ({ children, requireOnboarding = true }: ProtectedRouteProps) => {
  const location = useLocation();
  const returnTo = location.pathname === '/onboarding'
    ? safeReturnTo(new URLSearchParams(location.search).get('returnTo'))
    : location.pathname + location.search + location.hash;
  const [state, setState] = useState<GateState>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    let revision = 0;
    setState('checking');
    const check = async (session: Session | null) => {
      const current = ++revision;
      const publish = (next: GateState) => {
        if (mounted && current === revision) setState(next);
      };
      if (!session?.user) { publish('auth'); return; }
      if (!requireOnboarding) { publish('ready'); return; }
      try {
        const { data: profile, error } = await supabase.from('profiles')
          .select('onboarding_complete').eq('id', session.user.id).maybeSingle();
        if (error) throw error;
        if (profile?.onboarding_complete) { publish('ready'); return; }
        const { data: prefs, error: prefsError } = await supabase.from('user_preferences')
          .select('user_id').eq('user_id', session.user.id).maybeSingle();
        if (prefsError) throw prefsError;
        publish(prefs ? 'ready' : 'onboarding');
      } catch {
        publish('error');
      }
    };
    // Defer work outside the auth callback's internal lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = ++revision;
      setTimeout(() => { if (mounted && current === revision) void check(session); }, 0);
    });
    const initialRevision = revision;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted || revision !== initialRevision) return;
      if (error) setState('error');
      else void check(data.session);
    }).catch(() => { if (mounted) setState('error'); });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [requireOnboarding, attempt, returnTo]);

  if (state === 'auth' || state === 'onboarding') return <Navigate to={authStepPath(state, returnTo)} replace />;
  if (state === 'error') return (
    <main className="max-w-md mx-auto p-6 space-y-4 text-center" role="alert">
      <h1 className="text-xl font-semibold">We couldn't check your account</h1>
      <p>Check your connection and try again.</p>
      <Button onClick={() => setAttempt(value => value + 1)}>Try again</Button>
    </main>
  );
  if (state === 'checking') return (
    <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Checking your account">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
  return <>{children}</>;
};
