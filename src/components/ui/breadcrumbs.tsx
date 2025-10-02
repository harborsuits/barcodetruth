import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbsProps {
  brandName?: string;
}

export function Breadcrumbs({ brandName }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
      <Link 
        to="/" 
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        Home
      </Link>
      {brandName && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-foreground font-medium truncate max-w-[200px]">{brandName}</span>
        </>
      )}
    </nav>
  );
}
