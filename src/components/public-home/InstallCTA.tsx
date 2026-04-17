import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScanLine, Smartphone } from "lucide-react";

export function InstallCTA() {
  return (
    <section className="py-10">
      <div className="max-w-3xl mx-auto bg-card border border-border rounded-lg p-6 sm:p-8 text-center space-y-4">
        <Smartphone className="h-8 w-8 text-primary mx-auto" />
        <h2 className="font-display font-bold text-2xl text-foreground">
          Ready in the aisle.
        </h2>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Works instantly on your phone — no download needed.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild size="lg" className="h-12 px-8 gradient-forensic text-background">
            <Link to="/scan">
              <ScanLine className="mr-2 h-5 w-5" />
              Try a real scan
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 px-8 border-border/40">
            <Link to="/auth">Create free account</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
