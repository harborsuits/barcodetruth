import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, AlertCircle, Download, WifiOff, X, Flashlight, FlashlightOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  const [manualBarcode, setManualBarcode] = useState('');
  const [isSecure, setIsSecure] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<ReturnType<typeof createScanner> | null>(null);

  // Check HTTPS (except localhost)
  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';
    setIsSecure(isHttps || isLocalhost);
  }, []);

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
    
    // Analytics: scan detected
    console.log('[Analytics] scan_detect', { barcode, ts: Date.now() });
    
    // Haptic feedback (mobile)
    if ('vibrate' in navigator) {
      navigator.vibrate(35);
    }
    
    // Stop scanner temporarily while processing
    if (scannerRef.current) {
      scannerRef.current.stopScanning();
    }

    try {
      const t0 = performance.now();
      console.log('Resolving barcode:', barcode);
      
      const { data, error } = await supabase.functions.invoke('resolve-barcode', {
        body: { barcode }
      });

      const dur = Math.round(performance.now() - t0);

      if (error) throw error;

      if (data?.success && data?.brand?.id) {
        setScanResult('success');
        console.log('[Analytics] resolve_ok', { barcode, brand_id: data.brand.id, dur_ms: dur });
        
        // Prefetch brand page
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = `/brands/${data.brand.id}`;
        document.head.appendChild(link);
        
        toast({ 
          title: "Product found!", 
          description: `${data.product.name} by ${data.brand.name}` 
        });
        
        setTimeout(() => {
          console.log('[Analytics] brand_nav', { brand_id: data.brand.id });
          navigate(`/brands/${data.brand.id}`);
        }, 1000);
      } else {
        setScanResult('not_found');
        console.log('[Analytics] resolve_miss', { barcode, dur_ms: dur });
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
    console.log('[Analytics] scan_start', { ts: Date.now() });
    
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

  const handleManualSubmit = () => {
    const trimmed = manualBarcode.trim();
    if (trimmed.length >= 8 && trimmed.length <= 14 && /^\d+$/.test(trimmed)) {
      handleBarcodeDetected(trimmed);
      setManualBarcode('');
    } else {
      toast({
        title: "Invalid barcode",
        description: "Please enter 8-14 digits",
        variant: "destructive"
      });
    }
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
        {/* Status announcer for screen readers */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {scanResult === 'scanning' && 'Scanning for barcode'}
          {scanResult === 'processing' && 'Looking up product'}
          {scanResult === 'success' && 'Product found'}
          {scanResult === 'not_found' && 'Product not found'}
        </div>

        {/* HTTPS Warning */}
        {!isSecure && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-8 w-8 text-destructive flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-destructive">HTTPS Required</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Camera access requires a secure connection (HTTPS). 
                    Please access this page over HTTPS or localhost.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                    {/* Scanning reticle with animated corners */}
                    <div className="w-64 h-48 relative">
                      {/* Corner brackets */}
                      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                        {/* Top-left */}
                        <path d="M 0 24 L 0 0 L 24 0" stroke="hsl(var(--primary))" strokeWidth="4" fill="none" strokeLinecap="round"/>
                        {/* Top-right */}
                        <path d="M 232 0 L 256 0 L 256 24" stroke="hsl(var(--primary))" strokeWidth="4" fill="none" strokeLinecap="round"/>
                        {/* Bottom-left */}
                        <path d="M 0 168 L 0 192 L 24 192" stroke="hsl(var(--primary))" strokeWidth="4" fill="none" strokeLinecap="round"/>
                        {/* Bottom-right */}
                        <path d="M 232 192 L 256 192 L 256 168" stroke="hsl(var(--primary))" strokeWidth="4" fill="none" strokeLinecap="round"/>
                        {/* Scanning line animation */}
                        {scanResult === 'scanning' && (
                          <line x1="0" y1="96" x2="256" y2="96" stroke="hsl(var(--primary))" strokeWidth="2" opacity="0.6">
                            <animate attributeName="y1" values="20;172;20" dur="2s" repeatCount="indefinite"/>
                            <animate attributeName="y2" values="20;172;20" dur="2s" repeatCount="indefinite"/>
                          </line>
                        )}
                      </svg>
                      
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
                          aria-pressed={torchEnabled}
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
                    <div className="w-64 h-48 relative">
                      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                        <path d="M 0 24 L 0 0 L 24 0" stroke="hsl(var(--primary) / 0.5)" strokeWidth="4" fill="none" strokeLinecap="round"/>
                        <path d="M 232 0 L 256 0 L 256 24" stroke="hsl(var(--primary) / 0.5)" strokeWidth="4" fill="none" strokeLinecap="round"/>
                        <path d="M 0 168 L 0 192 L 24 192" stroke="hsl(var(--primary) / 0.5)" strokeWidth="4" fill="none" strokeLinecap="round"/>
                        <path d="M 232 192 L 256 192 L 256 168" stroke="hsl(var(--primary) / 0.5)" strokeWidth="4" fill="none" strokeLinecap="round"/>
                      </svg>
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
                
                <Button 
                  onClick={startScanner} 
                  className="w-full" 
                  aria-label="Start barcode scanner"
                  disabled={!isSecure}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Start Camera
                </Button>
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>📷 Camera stays on-device. We only read the barcode number.</p>
                  <p>Supports EAN-13, UPC-A, Code 128, and more</p>
                </div>

                {/* Manual barcode entry fallback */}
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">No camera? Enter barcode:</p>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="8-14 digits"
                      value={manualBarcode}
                      onChange={(e) => setManualBarcode(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                      maxLength={14}
                      className="flex-1"
                    />
                    <Button onClick={handleManualSubmit} disabled={manualBarcode.length < 8}>
                      Lookup
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {scanResult === 'scanning' && (
              <div className="mt-6 space-y-4 text-center">
                <div className="space-y-2">
                  <h3 className="font-semibold">Fill the frame with the barcode</h3>
                  <p className="text-sm text-muted-foreground">
                    {torchSupported 
                      ? "Use the flashlight in low light • Scans automatically when detected"
                      : "We'll automatically scan when detected • Works best in good lighting"
                    }
                  </p>
                </div>
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
                    <p className="font-semibold">We couldn't match this product yet</p>
                    <p className="text-sm text-muted-foreground">
                      Barcode {scannedBarcode} isn't in our database. 
                      Help us map it by reporting the product details.
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


