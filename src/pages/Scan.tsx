import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, AlertCircle, Download, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReportIssue } from "@/components/ReportIssue";
import { useState, useEffect } from "react";
import { initA2HS, triggerA2HS, isA2HSAvailable, dismissA2HS, isA2HSDismissed } from "@/lib/a2hs";
import { toast } from "@/hooks/use-toast";

export const Scan = () => {
  const navigate = useNavigate();
  const [scanResult, setScanResult] = useState<'pending' | 'success' | 'not_found'>('pending');
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  const [showA2HSPrompt, setShowA2HSPrompt] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Initialize A2HS
  useEffect(() => { 
    initA2HS(); 
  }, []);

  // Track scan count and show A2HS prompt
  useEffect(() => {
    const count = Number(localStorage.getItem('scan-count') || '0') + 1;
    localStorage.setItem('scan-count', String(count));
    
    const shouldPrompt = count >= 2 && isA2HSAvailable() && !isA2HSDismissed();
    if (shouldPrompt) {
      setShowA2HSPrompt(true);
    }
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast({ title: "Back online", description: "Connection restored" });
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast({ 
        title: "You're offline", 
        description: "Scans will be queued and sent when you're back online",
        variant: "destructive" 
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallApp = async () => {
    const accepted = await triggerA2HS();
    if (accepted) {
      toast({ title: "App installed!", description: "ShopSignals is now on your home screen" });
      setShowA2HSPrompt(false);
    } else {
      dismissA2HS();
      setShowA2HSPrompt(false);
    }
  };

  const handleMockScan = () => {
    // Simulate scanning a barcode
    const mockBarcode = '012345678901';
    setScannedBarcode(mockBarcode);
    
    // Simulate scan result after delay
    setTimeout(() => {
      // 70% success rate for demo
      if (Math.random() > 0.3) {
        setScanResult('success');
        setTimeout(() => navigate("/brand/nike"), 1000);
      } else {
        setScanResult('not_found');
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold">Scan Product</h1>
            </div>
            {isOffline && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <WifiOff className="h-4 w-4" />
                <span>Offline</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* A2HS Prompt */}
        {showA2HSPrompt && (
          <Card className="border-primary">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <Download className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold">Install ShopSignals</h3>
                  <p className="text-sm text-muted-foreground">
                    Add to your home screen for quick access and offline scanning
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleInstallApp} size="sm">
                      Install App
                    </Button>
                    <Button 
                      onClick={() => { dismissA2HS(); setShowA2HSPrompt(false); }} 
                      variant="ghost" 
                      size="sm"
                    >
                      Not now
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-6">
            <div className="aspect-[4/3] bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-48 border-4 border-primary/50 rounded-lg relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                </div>
              </div>
              <Camera className="h-16 w-16 text-muted-foreground" />
            </div>
            
            {scanResult === 'pending' && (
              <div className="mt-6 space-y-4 text-center">
                <div className="space-y-2">
                  <h3 className="font-semibold">Position barcode in frame</h3>
                  <p className="text-sm text-muted-foreground">
                    We'll automatically scan when the barcode is detected
                  </p>
                </div>
                
                <Button onClick={handleMockScan} className="w-full">
                  Simulate Scan (Demo)
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  Camera access required. This is a demo - real scanning will be available soon.
                </p>
              </div>
            )}
            
            {scanResult === 'not_found' && (
              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                  <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 space-y-2 text-left">
                    <p className="font-semibold">Product not found</p>
                    <p className="text-sm text-muted-foreground">
                      Barcode {scannedBarcode} isn't in our database yet. 
                      Help us add it by reporting the product details.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setScanResult('pending')}
                  >
                    Scan Again
                  </Button>
                  
                  <ReportIssue
                    subjectType="product"
                    subjectId={scannedBarcode}
                    contextUrl={`barcode:${scannedBarcode}`}
                    trigger={
                      <Button className="flex-1">
                        Report Product
                      </Button>
                    }
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};


