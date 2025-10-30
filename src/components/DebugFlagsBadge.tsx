import { useEffect, useState } from 'react';

interface DebugFlagsBadgeProps {
  flags: Record<string, any>;
}

export function DebugFlagsBadge({ flags }: DebugFlagsBadgeProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setShow(params.get("debug") === "flags");
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-3 right-3 z-50 rounded-md border px-3 py-2 text-xs bg-background/95 shadow-lg backdrop-blur-sm">
      <div className="font-medium mb-1 text-foreground">FEATURES</div>
      <pre className="max-h-48 max-w-[60vw] overflow-auto text-muted-foreground">
        {JSON.stringify(flags, null, 2)}
      </pre>
    </div>
  );
}
