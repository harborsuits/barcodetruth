import { Link } from "react-router-dom";

export function LaunchFooter() {
  return (
    <footer className="border-t border-border/30 py-10 px-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground/70">Built with purpose</p>
        <div className="flex gap-6">
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link to="/methodology" className="hover:text-foreground transition-colors">Methodology</Link>
        </div>
        <p>© {new Date().getFullYear()} Barcode Truth</p>
      </div>
    </footer>
  );
}
