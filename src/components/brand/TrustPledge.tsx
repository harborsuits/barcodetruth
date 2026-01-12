import { Info, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TRUST_PLEDGE } from "@/lib/riskLanguage";
import { useState } from "react";

export function TrustPledge() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2">
        <Info className="h-3 w-3" />
        <span>{TRUST_PLEDGE.title}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="p-4 rounded-lg bg-muted/50 border border-border/50 space-y-3">
          {TRUST_PLEDGE.principles.map((principle, i) => (
            <div key={i} className="space-y-0.5">
              <p className="text-sm font-medium">{principle.label}</p>
              <p className="text-xs text-muted-foreground">{principle.detail}</p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-2 border-t border-border/50 italic">
            {TRUST_PLEDGE.footer}
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
