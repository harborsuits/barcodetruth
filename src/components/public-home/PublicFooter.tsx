import { Link } from "react-router-dom";

export function PublicFooter() {
  return (
    <footer className="border-t border-border/20 py-8 mt-10">
      <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row justify-between gap-4 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Barcode Truth · Know more about what you buy.</p>
        <nav className="flex flex-wrap gap-4">
          <Link to="/why-trust-us" className="hover:text-foreground">Sources & trust</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
