import { Building2 } from "lucide-react";

type OwnershipNode = {
  id: string;
  name: string;
  logoUrl?: string;
  relation: "parent" | "subsidiary";
};

export function OwnershipSimple({ structure }: { structure: OwnershipNode[] }) {
  return (
    <div className="rounded-2xl border p-4">
      <h3 className="text-sm font-medium mb-3">Ownership</h3>
      {structure.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No control relationships on file.
        </p>
      ) : (
        <ul className="space-y-2">
          {structure.map((n) => (
            <li key={n.id} className="flex items-center gap-3">
              {n.logoUrl ? (
                <img src={n.logoUrl} className="w-6 h-6 rounded object-contain" alt="" />
              ) : (
                <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <div className="text-sm">
                <span className="font-medium">{n.name}</span>
                <span className="ml-2 text-xs text-muted-foreground capitalize">
                  ({n.relation})
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
