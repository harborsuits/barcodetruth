import { useNavigate } from "react-router-dom";
import { Camera, AlertCircle, WifiOff, X, Flashlight, FlashlightOff, Wrench, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ReportIssue } from "@/components/ReportIssue";
import { ScannerDiagnostics } from "@/components/ScannerDiagnostics";
import { AuthModal } from "@/components/AuthModal";
import { ScanLimitModal } from "@/components/ScanLimitModal";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { supabase } from "@/integrations/supabase/client";
import { useScanLimit } from "@/hooks/useScanLimit";
import { lookupScanAndLog } from "@/lib/scannerLookup";
import { analytics } from "@/lib/analytics";
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
  console.log('[Scanner] UI opened (first load)');
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
  const [showLimitModal, setShowLimitModal] = useState(false);
  const lastDetectedRef = useRef<string | null>(null);
  const lastDetectedAtRef = useRef<number>(0);
  
  // Auth state
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (!user) {
        console.log('[Scan] No user found, showing auth modal');
        setShowAuthModal(true);
      }
    };
    
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      
      if (!session?.user && event === 'SIGNED_OUT') {
        setShowAuthModal(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
    console.log('[Scan.tsx] Current state - processing:', scanResult === 'processing', 'pending:', pendingBarcode);
    
    // Ignore while processing or already confirming
    if (scanResult === 'processing' || pendingBarcode) {
      console.log('[Scan.tsx] Ignoring - already processing or confirming');
      return;
    }

    // Normalize input
    const detected = (barcode || '').trim();

    // Validate format
    if (!isValidProductBarcode(detected)) {
      console.log('[Scan.tsx] Invalid barcode format:', detected, 'length:', detected.length);
      return;
    }

    // SHORT-TERM deduplicate: same code within 800ms (reduced from 1500ms)
    const now = Date.now();
    if (lastDetectedRef.current === detected && now - lastDetectedAtRef.current < 800) {
      console.log('[Scan.tsx] Ignoring duplicate within 800ms');
      return;
    }
    
    lastDetectedRef.current = detected;
    lastDetectedAtRef.current = now;

    console.log('[Scan] confirmed barcode:', detected);
    // Pause scanning and show confirmation
    setPendingBarcode(detected);
    setShowConfirmDialog(true);
  }, [scanResult, pendingBarcode]);

  // Handle confirmed barcode lookup
  const handleConfirmedLookup = useCallback(async (barcode: string) => {
    if (!user) {
      console.log('[Scan] No user for lookup');
      setShowAuthModal(true);
      return;
    }

    setScannedBarcode(barcode);
    setScanResult('processing');
    
    console.log('[Analytics] scan_detect', { barcode, ts: Date.now() });
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(35);
    }
    
    try {
      const t0 = performance.now();
      
      // Use smart tiered lookup (cache → OpenFoodFacts → UPCitemdb → user submission)
      console.log('[Scan] Calling smart-product-lookup for:', barcode);
      const { data: smartLookup, error: smartError } = await supabase.functions.invoke('smart-product-lookup', {
        body: { barcode }
      });
      
      console.log('[Scan] smart-product-lookup response:', JSON.stringify({ 
        data: smartLookup, 
        error: smartError,
        hasProduct: !!smartLookup?.product,
        source: smartLookup?.source
      }, null, 2));
      
      // Handle "not found" response (edge function returns 404 but supabase wraps it)
      // The data will contain { product: null, requires_submission: true } for not found
      if (smartLookup?.requires_submission === true || smartLookup?.source === 'not_found') {
        setScanResult('not_found');
        const dur = Math.round(performance.now() - t0);
        console.log('[Analytics] scan_not_found_requires_submission', { barcode, dur_ms: dur });
        
        // Navigate to submission form with barcode in URL
        const route = `/scan-result/${barcode}?submission=true`;
        console.log('[Scan] navigating to:', route);
        navigate(route);
        return;
      }
      
      // Handle actual error (network failure, etc)
      if (smartError && !smartLookup) {
        console.error('[Scan] Edge function error:', smartError);
        throw new Error(smartError.message || 'Failed to lookup product');
      }
      
      // Check if we got a valid product
      if (!smartLookup?.product) {
        console.log('[Scan] No product in response, trying fallback lookup');
        
        // Fallback to old system
        const result = await lookupScanAndLog(barcode, user.id);
        
        const dur = Math.round(performance.now() - t0);

        if (result.notFound) {
          setScanResult('not_found');
          console.log('[Analytics] scan_not_found_soft_promise', { barcode, dur_ms: dur });
          
          toast({ 
            title: "We're on it", 
            description: result.message || "We're gathering evidence for this brand. Check back soon for updates.",
            variant: "default"
          });
          
          analytics.track('scan_not_found_soft_promise', { barcode });
          setTimeout(() => setScanResult('idle'), 1200);
          return;
        }

        const { product, alternatives } = result;
        
        if (product) {
          setScanResult('success');
          console.log('[Analytics] scan_success_fallback', { 
            barcode, 
            brand_id: product.brand_id, 
            dur_ms: dur 
          });
          
          toast({ 
            title: "Product found!", 
            description: `${product.product_name} - ${product.brand_name || 'Unknown'}`
          });
          
          setTimeout(() => {
            navigate(`/brand/${product.brand_id}`);
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
        return;
      }
      
      // Smart lookup success!
      const product = smartLookup.product;
      const brand = product.brands; // May be null for new/unmapped brands
      const dur = Math.round(performance.now() - t0);
      
      setScanResult('success');
      console.log('[Analytics] scan_success_smart', { 
        barcode, 
        brand_id: brand?.id || null,
        product_name: product.name,
        source: smartLookup.source,
        confidence: smartLookup.confidence,
        dur_ms: dur 
      });
      
      // Save to recent scans
      const recentScan = {
        upc: barcode,
        product_name: product.name,
        brand_name: brand?.name || 'Unknown Brand',
        timestamp: Date.now()
      };
      
      const stored = localStorage.getItem('recent_scans');
      const existing = stored ? JSON.parse(stored) : [];
      const updated = [recentScan, ...existing.filter((s: any) => s.upc !== barcode)].slice(0, 20);
      localStorage.setItem('recent_scans', JSON.stringify(updated));
      
      toast({ 
        title: "Product found!", 
        description: `${product.name} - ${brand?.name || 'Unknown Brand'}`
      });
      
      // Navigate based on whether we have a brand profile
      setTimeout(() => {
        if (brand?.id) {
          // Navigate to brand profile
          const route = `/brand/${brand.id}`;
          console.log('[Scan] navigating to brand:', route);
          analytics.track('scan_route_brand', { 
            brand_id: brand.id, 
            barcode,
            product_name: product.name,
            source: smartLookup.source
          });
          navigate(route);
        } else {
          // Navigate to scan result page (product found but no brand profile yet)
          const route = `/scan-result/${barcode}`;
          console.log('[Scan] navigating to scan-result (no brand):', route);
          analytics.track('scan_route_result_no_brand', { 
            barcode,
            product_name: product.name,
            source: smartLookup.source
          });
          navigate(route);
        }
      }, 800);
      
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
  }, [user, navigate]);

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
    // Check auth before allowing scan
    if (!user) {
      console.log('[Scan] Cannot scan - user not authenticated');
      setShowAuthModal(true);
      return;
    }

    // Check scan limit before starting camera - show modal instead of toast
    if (!can_scan) {
      setShowLimitModal(true);
      return;
    }
    
    try {
      if (!videoRef.current) {
        console.error('Video element not ready');
        setError('Video element not ready');
        return;
      }
      
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
      
      // Show permission explanation before requesting
      toast({
        title: "Camera permission needed",
        description: "We need camera access to scan barcodes. Your privacy is protected - images are not stored.",
      });
      
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
                  {/* Center target box */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 
                                    w-64 h-40 border-4 border-blue-500 rounded-lg">
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 
                                      bg-blue-500 text-white px-3 py-1 rounded text-sm whitespace-nowrap">
                        Center barcode here
                      </div>
                    </div>
                  </div>
                  
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

                  {/* Camera controls - simplified: just Torch (if available) and Stop */}
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 z-50 px-4">
                    {hasTorch && (
                      <Button
                        onClick={toggleTorch}
                        variant="secondary"
                        size="sm"
                        className="bg-card/90 backdrop-blur pointer-events-auto"
                        aria-label={torchEnabled ? "Turn torch off" : "Turn torch on"}
                      >
                        {torchEnabled ? (
                          <>
                            <FlashlightOff className="h-4 w-4 mr-1" />
                            Off
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
                      variant="secondary"
                      size="sm"
                      className="bg-card/90 backdrop-blur pointer-events-auto"
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

                {/* Quick-tap test UPCs */}
                <div className="pt-6 border-t">
                  <p className="text-xs text-muted-foreground text-center mb-3">
                    Try scanning these popular brands:
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                    {[
                      { name: "Coca-Cola", upc: "0049000042566" },
                      { name: "Pepsi", upc: "0012000000348" },
                      { name: "Nestlé", upc: "0028000805050" },
                      { name: "Kraft", upc: "0021000010240" },
                    ].map((item) => (
                      <Button
                        key={item.upc}
                        variant="outline"
                        size="sm"
                        className="justify-between text-xs"
                        onClick={() => handleConfirmedLookup(item.upc)}
                        disabled={!can_scan}
                      >
                        <span className="font-medium">{item.name}</span>
                        <code className="text-[10px] text-muted-foreground">{item.upc}</code>
                      </Button>
                    ))}
                  </div>
                </div>
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

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => {
            setShowAuthModal(false);
            navigate('/');
          }}
          onSuccess={() => {
            setShowAuthModal(false);
            checkLimit();
          }}
        />
      )}

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
              console.log('[Scan.tsx] User rejected barcode:', pendingBarcode);
              setPendingBarcode(null);
              setShowConfirmDialog(false);
              // Scanner will automatically resume and can detect the same barcode again after 800ms
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
      
      {/* Scan Limit Modal */}
      <ScanLimitModal 
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        scansRemaining={scans_remaining}
      />
    </div>
  );
};


