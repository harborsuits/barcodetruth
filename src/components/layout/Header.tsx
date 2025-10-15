import { Shield, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

export function Header() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => navigate("/")}
        >
          <img src={logo} alt="Logo" className="h-8 w-8" />
          <span className="font-semibold">BrandScores</span>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/trending")}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Trending
          </Button>
          {isAdmin === true && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/admin/health")}
            >
              <Shield className="mr-2 h-4 w-4" />
              Admin
            </Button>
          )}
          {isAdmin === null && (
            <span aria-busy="true" aria-live="polite" className="inline-block w-20 h-9" />
          )}
        </div>
      </div>
    </header>
  );
}
