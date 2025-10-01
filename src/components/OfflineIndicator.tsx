import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowAlert(true);
      setTimeout(() => setShowAlert(false), 3000);
    };
    
    const handleOffline = () => {
      setIsOffline(true);
      setShowAlert(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showAlert) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <Alert variant={isOffline ? "destructive" : "default"}>
        <div className="flex items-center gap-2">
          {isOffline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
          <AlertDescription>
            {isOffline 
              ? "You're offline. Scans will be queued." 
              : "Back online. Queued scans will be sent."}
          </AlertDescription>
        </div>
      </Alert>
    </div>
  );
}
