import { useRef, useState, useCallback, useEffect } from 'react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';
import { toast } from '@/hooks/use-toast';

interface ScannerOptions {
  onScan: (code: string) => void;
  onError?: (error: Error) => void;
  isProcessing?: boolean;
}

interface ScannerControls {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isScanning: boolean;
  hasPermission: boolean | null;
  isPaused: boolean;
  facingMode: 'user' | 'environment';
  hasTorch: boolean;
  torchEnabled: boolean;
  availableResolutions: MediaTrackSettings[];
  currentResolution: string;
  startScanning: () => Promise<void>;
  stopScanning: () => void;
  togglePause: () => void;
  toggleFacingMode: () => void;
  toggleTorch: () => Promise<void>;
  changeResolution: (resolution: string) => Promise<void>;
}

export function useBarcodeScanner({ onScan, onError, isProcessing }: ScannerOptions): ScannerControls {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();

  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [availableResolutions, setAvailableResolutions] = useState<MediaTrackSettings[]>([]);
  const [currentResolution, setCurrentResolution] = useState<string>('auto');

  const drawBoundingBox = useCallback((points: Array<{ x: number; y: number }>) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || points.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.stroke();
  }, []);

  const isScanningRef = useRef(false);

  const scanFrame = useCallback(async () => {
    if (isPaused || isProcessing || !videoRef.current || !readerRef.current || isScanningRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    isScanningRef.current = true;
    try {
      const result = await readerRef.current.decodeFromVideoElement(videoRef.current);
      if (result) {
        const detectedBarcode = result.getText();
        const points = result.getResultPoints();
        
        // CRITICAL: Only accept barcodes in the CENTER of the frame
        if (points && points.length >= 2) {
          const video = videoRef.current;
          const centerX = video.videoWidth / 2;
          const centerY = video.videoHeight / 2;
          
          // Calculate barcode center
          const barcodeX = points.reduce((sum, p) => sum + p.getX(), 0) / points.length;
          const barcodeY = points.reduce((sum, p) => sum + p.getY(), 0) / points.length;
          
          // Calculate distance from center
          const distanceX = Math.abs(barcodeX - centerX);
          const distanceY = Math.abs(barcodeY - centerY);
          
          // Only accept if within 40% of center
          const maxDistanceX = video.videoWidth * 0.4;
          const maxDistanceY = video.videoHeight * 0.4;
          
          if (distanceX > maxDistanceX || distanceY > maxDistanceY) {
            console.log('[Scanner] Barcode detected but too far from center - ignoring');
            animationFrameRef.current = requestAnimationFrame(scanFrame);
            return;
          }
        }
        
        console.log('[Scanner] decode success:', detectedBarcode);
        
        const mappedPoints = points.map(p => ({ x: p.getX(), y: p.getY() }));
        drawBoundingBox(mappedPoints);
        onScan(detectedBarcode);
        
        // Clear bounding box after 500ms
        setTimeout(() => {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
          }
        }, 500);
      }
    } catch (error) {
      // Ignore NotFoundExceptions (no barcode in frame)
      // Log other errors
      if (error && (error as Error).name !== 'NotFoundException') {
        console.warn('[Scanner] Detection error:', error);
      }
    }

    isScanningRef.current = false;
    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, [isPaused, isProcessing, onScan, drawBoundingBox]);

  const startScanning = useCallback(async () => {
    try {
      console.log('[Scanner] Starting scanner...');
      
      // CRITICAL: Full cleanup before starting (fixes first-open not scanning)
      if (streamRef.current) {
        console.log('[Scanner] Cleaning up existing stream before restart');
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      if (readerRef.current) {
        readerRef.current = null;
      }
      
      // Reset all state
      setIsPaused(false);
      isScanningRef.current = false;
      
      // Initialize reader with barcode formats
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
      ]);

      const reader = new BrowserMultiFormatReader(hints);
      readerRef.current = reader;
      console.log('[Scanner] Reader initialized with formats:', ['UPC_A', 'UPC_E', 'EAN_13', 'EAN_8']);

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          ...(currentResolution !== 'auto' && {
            width: { ideal: parseInt(currentResolution.split('x')[0]) },
            height: { ideal: parseInt(currentResolution.split('x')[1]) }
          })
        },
        audio: false
      };

      console.log('[Scanner] Requesting camera stream...');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      console.log('[Scanner] getUserMedia success');

      if (!videoRef.current) {
        throw new Error('Video element not available');
      }

      // Set video attributes for iOS and autoplay policy compliance
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.muted = true;
      videoRef.current.autoplay = true;
      videoRef.current.srcObject = stream;
      console.log('[Scanner] video srcObject set');
      
      // CRITICAL: Wait for video to be ACTUALLY playing (not just metadata loaded)
      await new Promise<void>((resolve, reject) => {
        const video = videoRef.current;
        if (!video) {
          reject(new Error('Video element lost'));
          return;
        }
        
        const timeout = setTimeout(() => {
          reject(new Error('Video start timeout'));
        }, 5000);
        
        const handlePlaying = () => {
          clearTimeout(timeout);
          video.removeEventListener('playing', handlePlaying);
          video.removeEventListener('error', handleError);
          console.log('[Scanner] playing event fired');
          resolve();
        };
        
        const handleError = (e: Event) => {
          clearTimeout(timeout);
          video.removeEventListener('playing', handlePlaying);
          video.removeEventListener('error', handleError);
          reject(new Error('Video playback error'));
        };
        
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('error', handleError);
        
        // Start playback
        video.play().then(() => {
          console.log('[Scanner] video.play resolved');
        }).catch(reject);
      });
      
      // CRITICAL: Frame-ready gate - wait until camera produces REAL frames
      // This definitively solves iOS/Safari timing issues where 'playing' fires
      // before the camera is actually producing frames
      const waitForRealFrames = async (): Promise<void> => {
        const video = videoRef.current;
        if (!video) throw new Error('Video lost during frame check');
        
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 64;
        testCanvas.height = 64;
        const ctx = testCanvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context unavailable');
        
        const maxAttempts = 15; // 1.5 seconds max
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          // Draw current video frame to canvas
          ctx.drawImage(video, 0, 0, 64, 64);
          const imageData = ctx.getImageData(0, 0, 64, 64);
          const data = imageData.data;
          
          // Calculate average brightness
          let totalBrightness = 0;
          for (let i = 0; i < data.length; i += 4) {
            // Luminance formula
            totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
          }
          const avgBrightness = totalBrightness / (data.length / 4);
          
          // If brightness > 5, we have real frames (not black)
          const hasRealFrames = avgBrightness > 5;
          console.log(`[Scanner] frame-ready: ${hasRealFrames} (attempt ${attempt}, brightness=${avgBrightness.toFixed(1)})`);
          
          if (hasRealFrames) {
            return;
          }
          
          // Wait 100ms before next attempt
          await new Promise(r => setTimeout(r, 100));
        }
        
        // After max attempts, proceed anyway but log warning
        console.warn('[Scanner] Frame-ready timeout - proceeding anyway');
      };
      
      await waitForRealFrames();

      // Check for torch capability
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities() as any;
      setHasTorch(!!capabilities.torch);

      // Get available resolutions
      const settings = videoTrack.getSettings();
      setAvailableResolutions([settings]);

      setHasPermission(true);
      
      // NOW set scanning to true and start detection loop
      setIsScanning(true);
      console.log('[Scanner] decode loop started');
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      
      console.log('[Scanner] ✅ Scanner started successfully');
    } catch (error: any) {
      console.error('[Scanner] Failed to start:', error);
      
      // Cleanup on failure
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setHasPermission(false);
      setIsScanning(false);
      onError?.(error);
      toast({
        title: "Camera Error",
        description: error.message || "Could not access camera",
        variant: "destructive",
      });
    }
  }, [facingMode, currentResolution, onError, scanFrame]);

  const stopScanning = useCallback(() => {
    console.log('[Scanner] Stopping scanner - full cleanup');
    
    // Cancel animation frame first
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    
    // Stop all media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('[Scanner] Stopped track:', track.kind);
      });
      streamRef.current = null;
    }
    
    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.load(); // Reset video element completely
    }
    
    // Clear reader
    readerRef.current = null;
    isScanningRef.current = false;
    
    // Reset state
    setIsScanning(false);
    setTorchEnabled(false);
    
    console.log('[Scanner] Cleanup complete');
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  const toggleFacingMode = useCallback(async () => {
    const wasScanning = isScanning;
    stopScanning();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    // Restart if it was scanning
    if (wasScanning) {
      setTimeout(() => startScanning(), 100);
    }
  }, [isScanning, stopScanning, startScanning]);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !hasTorch) return;

    const videoTrack = streamRef.current.getVideoTracks()[0];
    try {
      await videoTrack.applyConstraints({
        // @ts-ignore - torch is not in TypeScript types yet
        advanced: [{ torch: !torchEnabled }]
      });
      setTorchEnabled(prev => !prev);
    } catch (error) {
      console.error('Torch toggle error:', error);
      toast({
        title: "Torch Error",
        description: "Could not toggle torch",
        variant: "destructive",
      });
    }
  }, [hasTorch, torchEnabled]);

  const changeResolution = useCallback(async (resolution: string) => {
    setCurrentResolution(resolution);
    if (isScanning) {
      stopScanning();
      // Will restart on next render due to useEffect
    }
  }, [isScanning, stopScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return {
    videoRef,
    canvasRef,
    isScanning,
    hasPermission,
    isPaused,
    facingMode,
    hasTorch,
    torchEnabled,
    availableResolutions,
    currentResolution,
    startScanning,
    stopScanning,
    togglePause,
    toggleFacingMode,
    toggleTorch,
    changeResolution,
  };
}
