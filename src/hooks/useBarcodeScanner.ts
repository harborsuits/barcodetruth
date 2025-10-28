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

  const scanFrame = useCallback(async () => {
    if (isPaused || isProcessing || !videoRef.current || !readerRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

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
        
        console.log('[Scanner] ✅ DETECTED (centered):', detectedBarcode, 'at', new Date().toISOString());
        
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

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, [isPaused, isProcessing, onScan, drawBoundingBox]);

  const startScanning = useCallback(async () => {
    try {
      console.log('[Scanner] Starting scanner...');
      
      // IMPORTANT: Reset pause state
      setIsPaused(false);
      
      // Stop any existing stream first
      if (streamRef.current) {
        console.log('[Scanner] Stopping existing stream before restart');
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Cancel any pending animation frames
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      
      // Initialize reader
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
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          ...(currentResolution !== 'auto' && {
            width: { ideal: parseInt(currentResolution.split('x')[0]) },
            height: { ideal: parseInt(currentResolution.split('x')[1]) }
          })
        }
      };

      console.log('[Scanner] Getting camera stream...');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // CRITICAL: Wait for video to be ready before scanning
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              console.log('[Scanner] Video loaded, starting detection loop');
              resolve(true);
            };
          }
        });
        
        await videoRef.current.play();
      }

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
      console.log('[Scanner] Starting detection loop');
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      
      console.log('[Scanner] ✅ Scanner started successfully');
    } catch (error: any) {
      console.error('[Scanner] Failed to start:', error);
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
    console.log('[Scanner] Stopping scanner');
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    readerRef.current = null;
    setIsScanning(false);
    setTorchEnabled(false);
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
