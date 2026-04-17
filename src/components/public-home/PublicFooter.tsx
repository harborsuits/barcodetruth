import { Link } from "react-router-dom";

export function PublicFooter() {
  return (
    <footer className="border-t border-border/20 py-8 mt-10">
      <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row justify-between gap-4 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Barcode Truth — Independent scanner, no brand payments.</p>
        <nav className="flex flex-wrap gap-4">
          <Link to="/how-scores-work" className="hover:text-foreground">How scores work</Link>
          <Link to="/why-trust-us" className="hover:text-foreground">Why trust us</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
