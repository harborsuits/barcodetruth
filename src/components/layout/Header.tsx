import { Settings, ArrowLeft, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

interface HeaderProps {
  showBack?: boolean;
  showSettings?: boolean;
}

export function Header({ showBack = false, showSettings = true }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-center relative">
          {showBack && (
            <button 
              onClick={() => navigate(-1)}
              className="absolute left-0"
            >
              <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          )}
          {showSettings && !showBack && (
            <button 
              onClick={() => navigate("/settings")}
              className="absolute left-0"
            >
              <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          )}
          <button onClick={() => navigate("/")} className="hover:opacity-80 transition-opacity cursor-pointer" aria-label="Go home via logo">
            <img src={logo} alt="Barcode Truth logo" className="h-12 w-auto cursor-pointer" />
          </button>
          <button 
            onClick={() => navigate("/")} 
            className="absolute right-0" 
            aria-label="Go home"
          >
            <Home className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        </div>
      </div>
    </header>
  );
}
