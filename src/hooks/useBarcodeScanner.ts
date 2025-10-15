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
        const points = result.getResultPoints().map(p => ({ x: p.getX(), y: p.getY() }));
        drawBoundingBox(points);
        onScan(result.getText());
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
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, [isPaused, isProcessing, onScan, drawBoundingBox]);

  const startScanning = useCallback(async () => {
    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_128,
        BarcodeFormat.QR_CODE,
      ]);

      const reader = new BrowserMultiFormatReader(hints);
      readerRef.current = reader;

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          ...(currentResolution !== 'auto' && {
            width: { ideal: parseInt(currentResolution.split('x')[0]) },
            height: { ideal: parseInt(currentResolution.split('x')[1]) }
          })
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
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
      setIsScanning(true);

      // Start scanning loop
      scanFrame();
    } catch (error: any) {
      console.error('Scanner start error:', error);
      setHasPermission(false);
      onError?.(error);
      toast({
        title: "Camera Error",
        description: error.message || "Could not access camera",
        variant: "destructive",
      });
    }
  }, [facingMode, currentResolution, onError, scanFrame]);

  const stopScanning = useCallback(() => {
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

  const toggleFacingMode = useCallback(() => {
    stopScanning();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    // Will restart on next render due to useEffect
  }, [stopScanning]);

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

  // Auto-restart scanner when facingMode or resolution changes
  useEffect(() => {
    if (hasPermission && !isScanning) {
      startScanning();
    }
  }, [facingMode, currentResolution]);

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
