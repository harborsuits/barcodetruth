import { useState, useEffect } from "react";
import { Settings, ArrowLeft, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

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
      toast({ title: "Logged out", description: "You've been successfully logged out" });
      navigate('/auth');
    } catch (error) {
      toast({ title: "Error", description: "Failed to log out", variant: "destructive" });
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-center relative">
          {showBack && (
            <button 
              onClick={() => navigate(-1)}
              className="absolute left-0"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          )}
          {showSettings && !showBack && (
            <button 
              onClick={() => navigate("/settings")}
              className="absolute left-0"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          )}
          <button onClick={() => navigate("/")} className="hover:opacity-80 transition-opacity" aria-label="Go home">
            <img src={logo} alt="Barcode Truth logo" className="h-16 w-auto" />
          </button>
          {isAuthenticated && (
            <button 
              onClick={handleLogout}
              disabled={loggingOut}
              className="absolute right-0"
              aria-label="Log out"
            >
              <LogOut className={`h-5 w-5 text-muted-foreground hover:text-foreground transition-colors ${loggingOut ? 'opacity-50' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
