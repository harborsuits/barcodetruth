import { Shield } from "lucide-react";
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
            <div className="w-20 h-9" aria-hidden="true" />
          )}
        </div>
      </div>
    </header>
  );
}
