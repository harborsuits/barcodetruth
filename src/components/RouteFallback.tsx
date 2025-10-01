export function RouteFallback({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="p-6 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
