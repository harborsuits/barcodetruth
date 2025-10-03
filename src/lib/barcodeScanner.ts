import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';

export class BarcodeScanner {
  private reader: BrowserMultiFormatReader;
  private scanning = false;

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

      // Request camera access
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

      console.log('Starting barcode scanner with device:', deviceId);

      // Start continuous decode from camera
      await this.reader.decodeFromVideoDevice(
        deviceId,
        videoElement,
        (result, error) => {
          if (result) {
            const barcode = result.getText();
            console.log('Barcode detected:', barcode);
            onDetect(barcode);
          }
          if (error && !(error.name === 'NotFoundException')) {
            console.error('Scan error:', error);
          }
        }
      );

    } catch (error) {
      this.scanning = false;
      console.error('Failed to start scanner:', error);
      if (onError) {
        onError(error as Error);
      }
      throw error;
    }
  }

  stopScanning(): void {
    if (this.scanning) {
      this.reader.reset();
      this.scanning = false;
      console.log('Scanner stopped');
    }
  }

  isScanning(): boolean {
    return this.scanning;
  }
}

export const createScanner = () => new BarcodeScanner();
