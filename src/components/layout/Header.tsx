import { useState, useEffect } from "react";
import { Settings, ArrowLeft, LogOut, ScanLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface HeaderProps {
  showBack?: boolean;
  showSettings?: boolean;
}

export function Header({ showBack = false, showSettings = true }: HeaderProps) {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      toast({ title: "Logged out", description: "Session terminated" });
      navigate('/auth');
    } catch (error) {
      toast({ title: "Error", description: "Failed to log out", variant: "destructive" });
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/10">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left */}
          <div className="flex items-center gap-3">
            {showBack ? (
              <button 
                onClick={() => navigate(-1)}
                aria-label="Go back"
                className="p-1.5 hover:bg-elevated-2 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              </button>
            ) : showSettings ? (
              <button 
                onClick={() => navigate("/settings")}
                aria-label="Settings"
                className="p-1.5 hover:bg-elevated-2 transition-colors"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
              </button>
            ) : null}
          </div>

          {/* Center — Logo */}
          <button 
            onClick={() => navigate("/")} 
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            aria-label="Go home"
          >
            <ScanLine className="h-5 w-5 text-accent" />
            <span className="font-display font-bold text-sm tracking-widest uppercase text-foreground">
              Barcode Truth
            </span>
          </button>

          {/* Right */}
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button 
                onClick={handleLogout}
                disabled={loggingOut}
                className="p-1.5 hover:bg-elevated-2 transition-colors"
                aria-label="Log out"
              >
                <LogOut className={`h-4 w-4 text-muted-foreground ${loggingOut ? 'opacity-50' : ''}`} />
              </button>
            )}
            {!isAuthenticated && (
              <button
                onClick={() => navigate("/auth")}
                className="p-1.5 hover:bg-elevated-2 transition-colors"
                aria-label="Sign in"
              >
                <div className="h-6 w-6 rounded-full bg-elevated-2 border border-border/20 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground font-mono">?</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
