import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, AlertCircle, WifiOff, X, Flashlight, FlashlightOff, Wrench, Upload, FlipHorizontal, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ReportIssue } from "@/components/ReportIssue";
import { ScannerDiagnostics } from "@/components/ScannerDiagnostics";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { supabase } from "@/integrations/supabase/client";
import { useScanLimit } from "@/hooks/useScanLimit";
import { BrowserMultiFormatReader } from '@zxing/browser';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Validate product barcode format
function isValidProductBarcode(barcode: string): boolean {
  // UPC-A: 12 digits, EAN-13: 13 digits, UPC-E: 8 digits
  const validLengths = [8, 12, 13];
  const isNumeric = /^\d+$/.test(barcode);
  return isNumeric && validLengths.includes(barcode.length);
}

export const Scan = () => {
  const navigate = useNavigate();
  const { can_scan, scans_remaining, is_subscribed, trackScan, checkLimit } = useScanLimit();
  const [scanResult, setScanResult] = useState<'idle' | 'scanning' | 'processing' | 'success' | 'not_found'>('idle');
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [error, setError] = useState<string>('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [isSecure, setIsSecure] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isInIframe, setIsInIframe] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [rejectedBarcodes, setRejectedBarcodes] = useState<Set<string>>(new Set());
  const lastDetectedRef = useRef<string | null>(null);
  const lastDetectedAtRef = useRef<number>(0);

  // Check HTTPS (except localhost)
  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';
    setIsSecure(isHttps || isLocalhost);
  }, []);

  // Detect preview iframe context
  useEffect(() => {
    setIsInIframe(window.self !== window.top);
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

  // Full-screen mode styling
  useEffect(() => {
    const isFullscreen = new URLSearchParams(window.location.search).get('fullscreen') === '1';
    if (isFullscreen) {
      document.body.style.margin = '0';
      document.documentElement.style.height = '100%';
      document.body.style.height = '100%';
    }
    return () => {
      document.body.style.margin = '';
      document.documentElement.style.height = '';
      document.body.style.height = '';
    };
  }, []);

  const handleBarcodeDetected = useCallback((barcode: string) => {
    console.log('[Scan.tsx] handleBarcodeDetected called with:', barcode);
    console.log('[Scan.tsx] Current state - processing:', scanResult === 'processing', 'pending:', pendingBarcode, 'rejected:', rejectedBarcodes.has(barcode));
    
    // Ignore while processing or already confirming
    if (scanResult === 'processing' || pendingBarcode) {
      console.log('[Scan.tsx] Ignoring - already processing or confirming');
      return;
    }

    // Normalize input
    const detected = (barcode || '').trim();

    // Skip if already rejected in this session
    if (rejectedBarcodes.has(detected)) {
      console.log('[Scan.tsx] Skipping previously rejected barcode:', detected);
      return;
    }

    // Validate format
    if (!isValidProductBarcode(detected)) {
      console.log('[Scan.tsx] Invalid barcode format:', detected, 'length:', detected.length);
      return;
    }

    // Deduplicate same code within 1500ms
    const now = Date.now();
    if (lastDetectedRef.current === detected && now - lastDetectedAtRef.current < 1500) {
      console.log('[Scan.tsx] Ignoring duplicate within 1500ms');
      return;
    }
    lastDetectedRef.current = detected;
    lastDetectedAtRef.current = now;

    console.log('[Scan.tsx] Showing confirmation for barcode:', detected);
    // Pause scanning and show confirmation
    setPendingBarcode(detected);
    setShowConfirmDialog(true);
  }, [scanResult, pendingBarcode, rejectedBarcodes]);

  // Handle confirmed barcode lookup
  const handleConfirmedLookup = useCallback(async (barcode: string) => {
    setScannedBarcode(barcode);
    setScanResult('processing');
    
    console.log('[Analytics] scan_detect', { barcode, ts: Date.now() });
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(35);
    }
    
    try {
      const t0 = performance.now();
      
      // Call resolve-barcode endpoint (checks DB + OpenFoodFacts fallback)
      const { data, error } = await supabase.functions.invoke('resolve-barcode', {
        body: { barcode }
      });

      const dur = Math.round(performance.now() - t0);

      if (error) {
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          setScanResult('not_found');
          console.log('[Analytics] scan_not_found', { barcode, dur_ms: dur });
          toast({ 
            title: "Product not found", 
            description: "Try another barcode or search by brand",
            variant: "destructive" 
          });
          setTimeout(() => setScanResult('idle'), 800);
          return;
        }
        throw error;
      }

      if (data) {
        setScanResult('success');
        console.log('[Analytics] scan_success', { barcode, brand_id: data.brand_id, company_id: data.company_id, dur_ms: dur });
        
        // Track the scan
        if (data.brand_id) {
          await trackScan(data.brand_id, barcode);
        }
        
        // Save to recent scans
        const recentScan = {
          upc: data.upc,
          product_name: data.product_name,
          timestamp: Date.now()
        };
        
        const stored = localStorage.getItem('recent_scans');
        const existing = stored ? JSON.parse(stored) : [];
        const updated = [recentScan, ...existing.filter((s: any) => s.upc !== data.upc)].slice(0, 10);
        localStorage.setItem('recent_scans', JSON.stringify(updated));
        
        // Show ownership context in toast
        const ownershipInfo = data.company_name 
          ? `${data.brand_name} (owned by ${data.company_name})`
          : data.brand_name || 'Unknown';
        
        toast({ 
          title: "Product found!", 
          description: `${data.product_name} - ${ownershipInfo}`
        });
        
        // Navigate to brand page (shows ownership chain)
        setTimeout(() => {
          navigate(`/brand/${data.brand_id}`);
        }, 800);
      } else {
        setScanResult('not_found');
        toast({ 
          title: "Product not found", 
          description: "Try another barcode or search by brand",
          variant: "destructive" 
        });
        setTimeout(() => setScanResult('idle'), 800);
      }
    } catch (error: any) {
      console.error('[Analytics] scan_error', error);
      setScanResult('idle');
      toast({ 
        title: "Scan failed", 
        description: error?.message || "Try again",
        variant: "destructive" 
      });
      setTimeout(() => setScanResult('idle'), 800);
    }
  }, [trackScan]);

  // Barcode scanner hook (defined after handleBarcodeDetected)
  const {
    videoRef,
    canvasRef,
    isScanning,
    hasPermission,
    isPaused,
    facingMode,
    hasTorch,
    torchEnabled,
    startScanning: startBarcodeScanner,
    stopScanning: stopBarcodeScanner,
    togglePause,
    toggleFacingMode,
    toggleTorch,
  } = useBarcodeScanner({
    onScan: handleBarcodeDetected,
    isProcessing: scanResult === 'processing',
    onError: (err) => {
      console.error('Scanner error:', err);
      setError(err.message);
      setScanResult('idle');
      toast({
        title: "Camera error",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  const startScanner = async () => {
    try {
      if (!videoRef.current) {
        console.error('Video element not ready');
        setError('Video element not ready');
        return;
      }
      
      // Clear rejected barcodes when starting a fresh scan
      setRejectedBarcodes(new Set());
      setError('');
      setScanResult('scanning');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera not supported in this browser. Use manual entry below.');
        setScanResult('idle');
        toast({
          title: "Camera not supported",
          description: "Your browser doesn't support camera access. Use manual barcode entry below.",
          variant: "destructive"
        });
        return;
      }
      
      const inIframe = window.self !== window.top;
      if (inIframe) {
        setScanResult('idle');
        return;
      }
      
      await startBarcodeScanner();
      
    } catch (error: any) {
      console.error('startScanner crashed:', error);
      setError(error.message);
      setScanResult('idle');
      toast({
        title: "Camera error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const stopScanner = () => {
    stopBarcodeScanner();
    setScanResult('idle');
  };

  // Auto-lookup UPC from query param if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const upc = params.get('upc');
    
    // Validate UPC format (8-14 digits) before processing
    if (upc && /^\d{8,14}$/.test(upc) && scanResult === 'idle') {
      console.log('[Analytics] upc_prefill', { upc });
      
      // Stop scanner if running to avoid double toasts
      if (isScanning) {
        stopScanner();
      }
      
      handleConfirmedLookup(upc);
    }
  }, []); // Run once on mount

  // Stop scanner on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isScanning) {
        console.log('Page hidden, stopping scanner');
        stopScanner();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isScanning]);

  const onManualFallbackClick = () => {
    console.log('[Analytics] manual_fallback_click', { ts: Date.now(), scanResult });
    if (isScanning) {
      stopScanner();
    }
    setScanResult('idle');
    setShowManual(true);
    setTimeout(() => manualInputRef.current?.focus(), 50);
  };

  const handleManualSubmit = () => {
    const trimmed = manualBarcode.trim();
    if (isValidProductBarcode(trimmed)) {
      handleConfirmedLookup(trimmed);
      setManualBarcode('');
    } else {
      toast({
        title: "Invalid barcode",
        description: "Please enter 8, 12, or 13 digits",
        variant: "destructive"
      });
    }
  };

  const onUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    setScanResult('processing');
    
    try {
      const img = new Image();
      img.onload = async () => {
        try {
          const reader = new BrowserMultiFormatReader();
          const result = await reader.decodeFromImageElement(img);
          if (result) {
            const detectedBarcode = result.getText();
            if (isValidProductBarcode(detectedBarcode)) {
              await handleConfirmedLookup(detectedBarcode);
            } else {
              toast({ 
                title: 'Invalid barcode format', 
                description: 'Barcode must be 8, 12, or 13 digits' 
              });
              setScanResult('idle');
            }
          } else {
            toast({ title: 'No barcode detected in image' });
            setScanResult('idle');
          }
        } catch (err: any) {
          toast({ 
            title: 'Failed to decode barcode', 
            description: err?.message || 'Could not read barcode from image' 
          });
          setScanResult('idle');
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast({ title: 'Could not read image' });
        setScanResult('idle');
      };
      img.src = url;
    } catch (err: any) {
      URL.revokeObjectURL(url);
      toast({ title: 'Failed to process image', description: err?.message });
      setScanResult('idle');
    }
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowDiagnostics(true)}
                title="Scanner Diagnostics"
              >
                <Wrench className="h-5 w-5" />
              </Button>
              {rejectedBarcodes.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRejectedBarcodes(new Set());
                    toast({
                      title: "Scanner reset",
                      description: "Cleared blacklist of rejected barcodes",
                    });
                  }}
                  className="text-xs"
                >
                  Reset ({rejectedBarcodes.size})
                </Button>
              )}
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

        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="relative w-full max-w-full aspect-[4/3] bg-muted rounded-lg flex items-center justify-center overflow-hidden">
              {/* Video and canvas - always in DOM, hidden when not scanning */}
              <div className={`relative w-full h-full ${isScanning || scanResult === 'processing' ? 'block' : 'hidden'}`}>
                <video 
                  ref={videoRef} 
                  className={`absolute inset-0 w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                  playsInline
                  muted
                />
                <canvas 
                  ref={canvasRef} 
                  className="absolute inset-0 pointer-events-none z-10" 
                />
              </div>

              {/* Debug overlay - shows scanning status */}
              {isScanning && (
                <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-mono z-30">
                  <div>Status: {isPaused ? 'PAUSED' : 'SCANNING'}</div>
                  <div>Camera: {facingMode}</div>
                  <div>Processing: {scanResult === 'processing' ? 'YES' : 'NO'}</div>
                </div>
              )}

              {/* Scanning UI overlay - only visible when scanning */}
              {(isScanning || scanResult === 'processing') && (
                <>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
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
                        {/* Scanning line animation (hide when paused) */}
                        {!isPaused && (
                          <line x1="0" y1="96" x2="256" y2="96" stroke="hsl(var(--primary))" strokeWidth="2" opacity="0.6" className="motion-reduce:hidden">
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

                  {/* Camera controls */}
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20 pointer-events-auto px-4">
                    <Button
                      onClick={toggleFacingMode}
                      variant="secondary"
                      size="sm"
                      className="bg-card/90 backdrop-blur"
                      aria-label="Flip camera"
                    >
                      <FlipHorizontal className="h-4 w-4 mr-1" />
                      Flip
                    </Button>
                    <Button
                      onClick={togglePause}
                      variant="secondary"
                      size="sm"
                      className="bg-card/90 backdrop-blur"
                      aria-label={isPaused ? "Resume scanning" : "Pause scanning"}
                    >
                      {isPaused ? (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause className="h-4 w-4 mr-1" />
                          Pause
                        </>
                      )}
                    </Button>
                    {hasTorch && (
                      <Button
                        onClick={toggleTorch}
                        variant="secondary"
                        size="sm"
                        className="bg-card/90 backdrop-blur"
                        aria-label={torchEnabled ? "Turn torch off" : "Turn torch on"}
                      >
                        {torchEnabled ? (
                          <>
                            <FlashlightOff className="h-4 w-4 mr-1" />
                            Torch
                          </>
                        ) : (
                          <>
                            <Flashlight className="h-4 w-4 mr-1" />
                            Torch
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      onClick={stopScanner}
                      variant="ghost"
                      size="sm"
                      className="bg-card/90 backdrop-blur"
                      aria-label="Stop scanning"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Stop
                    </Button>
                  </div>

                  {/* Aria-live status for screen readers */}
                  <div className="sr-only" aria-live="polite">
                    {isPaused ? "Scanning paused" : "Scanning for barcode..."}
                  </div>
                </>
              )}
              
              {/* Idle state placeholder - only visible when not scanning */}
              {!(isScanning || scanResult === 'processing') && (
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
                  {!is_subscribed && (
                    <p className="text-sm font-medium text-primary">
                      {scans_remaining} free scans remaining this month
                    </p>
                  )}
                </div>
                
                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
                
                <div className="flex flex-col gap-3 items-center">
                <div className="flex items-center gap-3 justify-center">
                  <Button 
                    onClick={startScanner} 
                    aria-label="Start barcode scanner"
                    disabled={!isSecure || !can_scan}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Start Camera
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={onManualFallbackClick} 
                    aria-label="Enter barcode manually"
                    disabled={!can_scan}
                  >
                    Enter barcode instead
                  </Button>
                </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!can_scan}
                      aria-label="Upload barcode photo"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload photo
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onUploadImage}
                      aria-label="Choose barcode image file"
                    />
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>📷 Privacy: Video stays on your device. We only read the barcode number.</p>
                  <p>Supports EAN-13, UPC-A, Code 128, and more</p>
                </div>

                {/* Manual barcode entry (when showManual is true) */}
                {showManual && (
                  <div className="pt-4 border-t">
                    <label htmlFor="manual-barcode" className="text-sm font-medium">No camera? Enter barcode:</label>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        id="manual-barcode"
                        ref={manualInputRef}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="e.g., 0123456789012"
                        value={manualBarcode}
                        onChange={(e) => setManualBarcode(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                        maxLength={14}
                        className="flex-1"
                        aria-label="Enter barcode digits manually"
                      />
                      <Button onClick={handleManualSubmit} disabled={manualBarcode.length < 8} aria-label="Look up barcode">
                        Lookup
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Supports 8–14 digit EAN/UPC/ITF/Code 128 formats.
                    </p>
                  </div>
                )}
              </div>
            )}

            {isScanning && (
              <div className="mt-6 space-y-4 text-center">
                <div className="space-y-2">
                  <h3 className="font-semibold">
                    {isPaused ? "Scanning paused" : "Fill the frame with the barcode"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isPaused 
                      ? "Press Resume to continue scanning"
                      : hasTorch 
                        ? "Use Flip to switch cameras • Torch for low light • Scans automatically"
                        : "Use Flip to switch cameras • Scans automatically when detected"
                    }
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    📷 Privacy: Video stays on your device. We only read the barcode number.
                  </p>
                  <div className="mt-4 flex items-center justify-center">
                    <Button variant="secondary" onClick={onManualFallbackClick} aria-label="Enter barcode manually">
                      Enter barcode instead
                    </Button>
                  </div>
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

        {/* FAQ Drawer */}
        <details className="rounded-lg border p-4 bg-card">
          <summary className="cursor-pointer select-none text-sm font-medium">
            Having trouble? (FAQ)
          </summary>
          <div className="mt-3 space-y-3 text-sm text-muted-foreground">
            <div>
              <div className="font-medium text-foreground">Why won't my camera start?</div>
              <ul className="list-disc pl-5 mt-1">
                <li>Use HTTPS (or localhost)—browsers block cameras on insecure pages.</li>
                <li>Allow camera permission in your browser settings.</li>
                <li>Close other apps using the camera (Zoom/Teams/etc.).</li>
                <li>Your browser/device may not support camera access—use "Enter barcode instead".</li>
              </ul>
            </div>
            <div>
              <div className="font-medium text-foreground">It's too dark / won't detect.</div>
              <ul className="list-disc pl-5 mt-1">
                <li>Move to brighter light or use the flashlight if available.</li>
                <li>Fill ~60% of the reticle with the barcode; avoid glare and curve.</li>
                <li>If the code is damaged, type the digits manually.</li>
              </ul>
            </div>
            <div>
              <div className="font-medium text-foreground">Which codes are supported?</div>
              <p className="mt-1">EAN-13, EAN-8, UPC-A, UPC-E, ITF, Code 128, Code 39 (QR/Data Matrix not yet).</p>
            </div>
          </div>
        </details>
      </main>

      {/* Barcode Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Barcode Detected</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Is this the correct barcode?</p>
              <div className="font-mono text-lg font-semibold text-foreground bg-muted p-3 rounded-md text-center">
                {pendingBarcode}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              // Add to rejection blacklist
              if (pendingBarcode) {
                setRejectedBarcodes(prev => new Set(prev).add(pendingBarcode));
                console.log('Blacklisted barcode:', pendingBarcode);
                toast({
                  title: "Barcode ignored",
                  description: "Won't detect this barcode again this session",
                });
              }
              setPendingBarcode(null);
              setShowConfirmDialog(false);
            }}>
              No, scan again
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingBarcode) {
                handleConfirmedLookup(pendingBarcode);
                setPendingBarcode(null);
              }
              setShowConfirmDialog(false);
            }}>
              Yes, look it up
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ScannerDiagnostics open={showDiagnostics} onOpenChange={setShowDiagnostics} />
      
      {/* Debug Panel - Shows real-time detection */}
      <div className="fixed bottom-0 left-0 right-0 bg-black text-white p-3 text-xs font-mono overflow-auto max-h-40 z-50 border-t-2 border-green-500">
        <div className="font-bold text-green-400 mb-2">🔍 SCANNER DEBUG (Remove after fixing)</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-gray-400">Last detected:</span>
            <span className="ml-2 text-yellow-300 font-bold">
              {lastDetectedRef.current || 'none'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Detected at:</span>
            <span className="ml-2 text-yellow-300">
              {lastDetectedAtRef.current ? new Date(lastDetectedAtRef.current).toLocaleTimeString() : 'never'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Pending:</span>
            <span className="ml-2 text-cyan-300 font-bold">
              {pendingBarcode || 'none'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Rejected:</span>
            <span className="ml-2 text-red-400">
              {rejectedBarcodes.size} codes
            </span>
          </div>
          <div>
            <span className="text-gray-400">Scanning:</span>
            <span className={`ml-2 font-bold ${isScanning ? 'text-green-400' : 'text-red-400'}`}>
              {isScanning ? 'YES ✓' : 'NO ✗'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">State:</span>
            <span className="ml-2 text-purple-400">
              {scanResult}
            </span>
          </div>
        </div>
        <div className="mt-2 text-yellow-400 animate-pulse">
          ⚡ Watch this panel - it updates in REAL-TIME as barcodes are detected
        </div>
        {rejectedBarcodes.size > 0 && (
          <div className="mt-2 text-red-400">
            Blacklisted: {Array.from(rejectedBarcodes).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
};


