import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, AlertCircle, Download, WifiOff, X, Flashlight, FlashlightOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReportIssue } from "@/components/ReportIssue";
import { useState, useEffect, useRef } from "react";
import { initA2HS, triggerA2HS, isA2HSAvailable, dismissA2HS, isA2HSDismissed } from "@/lib/a2hs";
import { toast } from "@/hooks/use-toast";
import { createScanner } from "@/lib/barcodeScanner";
import { supabase } from "@/integrations/supabase/client";

export const Scan = () => {
  const navigate = useNavigate();
  const [scanResult, setScanResult] = useState<'idle' | 'scanning' | 'processing' | 'success' | 'not_found'>('idle');
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  const [showA2HSPrompt, setShowA2HSPrompt] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [error, setError] = useState<string>('');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<ReturnType<typeof createScanner> | null>(null);

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

  const handleBarcodeDetected = async (barcode: string) => {
    if (scanResult === 'processing') return; // Debounce multiple detections
    
    setScannedBarcode(barcode);
    setScanResult('processing');
    
    // Stop scanner temporarily while processing
    if (scannerRef.current) {
      scannerRef.current.stopScanning();
    }

    try {
      console.log('Resolving barcode:', barcode);
      
      const { data, error } = await supabase.functions.invoke('resolve-barcode', {
        body: { barcode }
      });

      if (error) throw error;

      if (data?.success && data?.brand?.id) {
        setScanResult('success');
        toast({ 
          title: "Product found!", 
          description: `${data.product.name} by ${data.brand.name}` 
        });
        setTimeout(() => navigate(`/brands/${data.brand.id}`), 1000);
      } else {
        setScanResult('not_found');
        toast({ 
          title: "Product not found", 
          description: "Help us add it to the database",
          variant: "destructive" 
        });
      }
    } catch (error: any) {
      console.error('Barcode resolution error:', error);
      setScanResult('not_found');
      toast({ 
        title: "Scan failed", 
        description: error?.message || "Please try again",
        variant: "destructive" 
      });
    }
  };

  const startScanner = async () => {
    if (!videoRef.current) return;
    
    setError('');
    setScanResult('scanning');
    
    try {
      if (!scannerRef.current) {
        scannerRef.current = createScanner();
      }
      
      await scannerRef.current.startScanning(
        videoRef.current,
        handleBarcodeDetected,
        (err) => {
          setError(err.message);
          setScanResult('idle');
        }
      );

      // Check torch support after camera starts
      setTimeout(() => {
        if (scannerRef.current) {
          setTorchSupported(scannerRef.current.isTorchSupported());
        }
      }, 500);
      
    } catch (err: any) {
      console.error('Scanner start error:', err);
      setError(err?.message || 'Failed to access camera');
      setScanResult('idle');
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stopScanning();
    }
    setScanResult('idle');
    setTorchEnabled(false);
    setTorchSupported(false);
  };

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    
    const success = await scannerRef.current.toggleTorch();
    if (success) {
      setTorchEnabled(scannerRef.current.isTorchEnabled());
    } else {
      toast({
        title: "Torch not available",
        description: "This device doesn't support flashlight control",
        variant: "destructive"
      });
    }
  };

  // Stop scanner on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && scanResult === 'scanning') {
        console.log('Page hidden, pausing scanner');
        stopScanner();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [scanResult]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stopScanning();
      }
    };
  }, []);

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
              {scanResult === 'scanning' || scanResult === 'processing' ? (
                <>
                  <video 
                    ref={videoRef} 
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-48 border-4 border-primary rounded-lg relative">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                      {scanResult === 'processing' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
                        </div>
                      )}
                    </div>
                  </div>
                  {scanResult === 'scanning' && (
                    <>
                      <Button
                        onClick={stopScanner}
                        variant="destructive"
                        size="icon"
                        className="absolute top-4 right-4 z-10"
                        aria-label="Stop scanning"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      {torchSupported && (
                        <Button
                          onClick={toggleTorch}
                          variant={torchEnabled ? "default" : "outline"}
                          size="icon"
                          className="absolute top-4 left-4 z-10 bg-card/80 backdrop-blur"
                          aria-label={torchEnabled ? "Turn off flashlight" : "Turn on flashlight"}
                        >
                          {torchEnabled ? (
                            <Flashlight className="h-4 w-4" />
                          ) : (
                            <FlashlightOff className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-64 h-48 border-4 border-primary/50 rounded-lg relative">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                    </div>
                  </div>
                  <Camera className="h-16 w-16 text-muted-foreground" />
                </>
              )}
            </div>
            
            {scanResult === 'idle' && (
              <div className="mt-6 space-y-4 text-center">
                <div className="space-y-2">
                  <h3 className="font-semibold">Ready to scan</h3>
                  <p className="text-sm text-muted-foreground">
                    Position a product barcode in front of your camera for instant brand analysis
                  </p>
                </div>
                
                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
                
                <Button onClick={startScanner} className="w-full" aria-label="Start barcode scanner">
                  <Camera className="mr-2 h-4 w-4" />
                  Start Camera
                </Button>
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>📷 Camera access required • Video never leaves your device</p>
                  <p>Supports EAN-13, UPC-A, Code 128, and more</p>
                </div>
              </div>
            )}

            {scanResult === 'scanning' && (
              <div className="mt-6 space-y-4 text-center">
                <div className="space-y-2">
                  <h3 className="font-semibold">Fill the frame with the barcode</h3>
                  <p className="text-sm text-muted-foreground">
                    We'll automatically scan when detected • Works best in good lighting
                  </p>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  {torchSupported && "💡 Tap flashlight icon for low light • "}
                  Scanning continuously...
                </p>
              </div>
            )}

            {scanResult === 'processing' && (
              <div className="mt-6 space-y-4 text-center">
                <div className="space-y-2">
                  <h3 className="font-semibold">Looking up product...</h3>
                  <p className="text-sm text-muted-foreground">
                    Barcode: {scannedBarcode}
                  </p>
                </div>
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
                    onClick={() => {
                      setScannedBarcode('');
                      startScanner();
                    }}
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


