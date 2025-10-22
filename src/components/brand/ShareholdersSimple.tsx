import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Holder = {
  name: string;
  pct: number;
  isAssetManager?: boolean;
};

export function ShareholdersSimple({ holders }: { holders: Holder[] }) {
  if (!holders?.length) return null;

  return (
    <div className="rounded-2xl border p-4">
      <h3 className="text-sm font-medium mb-2">Top shareholders</h3>
      <Alert className="mb-3">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Displayed for public companies. These are investors and do not imply control.
        </AlertDescription>
      </Alert>
      <ul className="space-y-2">
        {holders.map((h) => (
          <li key={h.name} className="flex items-center justify-between gap-3">
            <div className="text-sm flex items-center gap-2">
              <span className="font-medium">{h.name}</span>
              {h.isAssetManager && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                  Asset manager
                </Badge>
              )}
            </div>
            <div className="text-sm tabular-nums">{h.pct.toFixed(2)}%</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
