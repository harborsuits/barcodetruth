import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat, Result } from '@zxing/library';

export class BarcodeScanner {
  private reader: BrowserMultiFormatReader;
  private scanning = false;
  private lastScan = { code: '', ts: 0 };
  private torchEnabled = false;
  private videoTrack: MediaStreamTrack | null = null;

  constructor() {
    const hints = new Map();
    // Support common barcode formats found on retail products
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,      // Most common retail barcode
      BarcodeFormat.EAN_8,       // Short EAN
      BarcodeFormat.UPC_A,       // North American products
      BarcodeFormat.UPC_E,       // Short UPC
      BarcodeFormat.CODE_128,    // Logistics/shipping
      BarcodeFormat.CODE_39,     // General purpose
      BarcodeFormat.ITF,         // Cartons/cases
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    
    this.reader = new BrowserMultiFormatReader(hints);
  }

  private normalizeBarcode(code: string): string {
    // Convert UPC-A to EAN-13 format (prefix with 0)
    if (code.length === 12 && /^\d+$/.test(code)) {
      return '0' + code;
    }
    return code;
  }

  async startScanning(
    videoElement: HTMLVideoElement,
    onDetect: (barcode: string) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    if (this.scanning) {
      console.warn('Already scanning');
      return;
    }

    try {
      this.scanning = true;

      // Set attributes for iOS compatibility
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('autoplay', 'true');
      videoElement.muted = true;

      // Try facingMode first (better for mobile)
      try {
        console.log('Starting scanner with facingMode: environment');
        
        await this.reader.decodeFromConstraints(
          { 
            video: { 
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            } 
          },
          videoElement,
          (result, error) => this.handleDecodeResult(result, error, onDetect)
        );

        // Store track reference for torch control
        const stream = videoElement.srcObject as MediaStream;
        if (stream) {
          this.videoTrack = stream.getVideoTracks()[0];
        }

      } catch (facingModeError) {
        // Fallback to device enumeration
        console.log('facingMode failed, falling back to device enumeration');
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');

        if (videoDevices.length === 0) {
          throw new Error('No camera found on this device');
        }

        // Prefer back camera on mobile
        const backCamera = videoDevices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        );
        const deviceId = backCamera?.deviceId || videoDevices[0].deviceId;

        console.log('Using camera device:', deviceId);

        await this.reader.decodeFromVideoDevice(
          deviceId,
          videoElement,
          (result, error) => this.handleDecodeResult(result, error, onDetect)
        );

        // Store track reference
        const stream = videoElement.srcObject as MediaStream;
        if (stream) {
          this.videoTrack = stream.getVideoTracks()[0];
        }
      }

    } catch (error) {
      this.scanning = false;
      console.error('Failed to start scanner:', error);
      
      // Map common errors to friendly messages
      const friendlyError = this.getFriendlyError(error as Error);
      
      if (onError) {
        onError(new Error(friendlyError));
      }
      throw new Error(friendlyError);
    }
  }

  private handleDecodeResult(
    result: Result | undefined,
    error: Error | undefined,
    onDetect: (barcode: string) => void
  ): void {
    if (result) {
      const now = Date.now();
      const code = this.normalizeBarcode(result.getText());
      
      // Throttle duplicate scans (4 second window)
      if (code === this.lastScan.code && now - this.lastScan.ts < 4000) {
        return;
      }
      
      this.lastScan = { code, ts: now };
      console.log('Barcode detected:', code);
      onDetect(code);
    }
    
    // Only log non-NotFoundException errors
    if (error && error.name !== 'NotFoundException') {
      console.error('Scan error:', error);
    }
  }

  private getFriendlyError(error: Error): string {
    const name = error.name || '';
    const message = error.message || '';

    if (name === 'NotAllowedError' || message.includes('Permission denied')) {
      return 'Camera permission denied. Please allow camera access in your browser settings.';
    }
    
    if (name === 'NotFoundError' || message.includes('No camera')) {
      return 'No camera found on this device.';
    }
    
    if (name === 'NotReadableError' || message.includes('in use')) {
      return 'Camera is in use by another app. Please close other apps and try again.';
    }
    
    if (name === 'SecurityError' || message.includes('secure')) {
      return 'Camera requires HTTPS. Please use a secure connection.';
    }
    
    return message || 'Failed to access camera. Please try again.';
  }

  async toggleTorch(): Promise<boolean> {
    if (!this.videoTrack) {
      console.warn('No video track available for torch control');
      return false;
    }

    try {
      const capabilities = this.videoTrack.getCapabilities() as any;
      
      if (!capabilities.torch) {
        console.warn('Torch not supported on this device');
        return false;
      }

      this.torchEnabled = !this.torchEnabled;
      
      await this.videoTrack.applyConstraints({
        // @ts-ignore - torch is not in standard types yet
        advanced: [{ torch: this.torchEnabled }]
      });

      console.log('Torch toggled:', this.torchEnabled);
      return true;
    } catch (error) {
      console.error('Failed to toggle torch:', error);
      return false;
    }
  }

  isTorchSupported(): boolean {
    if (!this.videoTrack) return false;
    const capabilities = this.videoTrack.getCapabilities() as any;
    return !!capabilities.torch;
  }

  isTorchEnabled(): boolean {
    return this.torchEnabled;
  }

  stopScanning(): void {
    if (this.scanning) {
      this.reader.reset();
      this.scanning = false;
      this.videoTrack = null;
      this.torchEnabled = false;
      console.log('Scanner stopped');
    }
  }

  isScanning(): boolean {
    return this.scanning;
  }
}

export const createScanner = () => new BarcodeScanner();
