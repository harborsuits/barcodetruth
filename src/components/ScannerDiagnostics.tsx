import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, AlertCircle, Loader2, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface DiagnosticResult {
  check: string;
  status: 'pending' | 'pass' | 'fail' | 'warning';
  message: string;
  latencyMs?: number;
  error?: string;
}

export function ScannerDiagnostics({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);

  const runDiagnostics = async () => {
    setRunning(true);
    const checks: DiagnosticResult[] = [];

    // 1. Check navigator.mediaDevices support
    checks.push({
      check: 'Browser Support',
      status: navigator.mediaDevices ? 'pass' : 'fail',
      message: navigator.mediaDevices 
        ? 'getUserMedia API is supported' 
        : 'getUserMedia not supported in this browser'
    });
    setResults([...checks]);

    // 2. Check HTTPS
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';
    checks.push({
      check: 'Secure Context',
      status: (isHttps || isLocalhost) ? 'pass' : 'fail',
      message: (isHttps || isLocalhost) 
        ? 'Running on secure connection' 
        : 'Camera requires HTTPS or localhost'
    });
    setResults([...checks]);

    // 3. Check if in iframe
    const inIframe = window.self !== window.top;
    checks.push({
      check: 'Environment',
      status: inIframe ? 'warning' : 'pass',
      message: inIframe 
        ? 'Running in iframe (preview) - camera may be restricted' 
        : 'Running in top-level window'
    });
    setResults([...checks]);

    // 4. Check camera permission
    if (navigator.mediaDevices) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        
        checks.push({
          check: 'Camera Permission',
          status: 'pass',
          message: 'Camera access granted'
        });
        
        // Check for torch support
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities() as any;
        const hasTorch = !!capabilities.torch;
        
        checks.push({
          check: 'Torch/Flash',
          status: hasTorch ? 'pass' : 'warning',
          message: hasTorch ? 'Flashlight is supported' : 'No flashlight support detected'
        });
        
        // Stop the test stream
        stream.getTracks().forEach(track => track.stop());
      } catch (err: any) {
        checks.push({
          check: 'Camera Permission',
          status: 'fail',
          message: err.name === 'NotAllowedError' 
            ? 'Camera permission denied - check browser settings' 
            : err.message || 'Failed to access camera'
        });
      }
      setResults([...checks]);
    }

    // 5. Test scan-product endpoint with real barcode
    const testBarcode = '049000000009'; // Real 7-Eleven product
    const idx = checks.push({
      check: 'Endpoint Test',
      status: 'pending',
      message: `Testing scan-product with ${testBarcode}...`
    }) - 1;
    setResults([...checks]);

    const t0 = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke('scan-product', {
        body: { upc: testBarcode }
      });
      const latency = Math.round(performance.now() - t0);

      if (error) {
        checks[idx] = {
          check: 'Endpoint Test',
          status: 'fail',
          message: `Error: ${error.message}`,
          latencyMs: latency,
          error: error.message
        };
      } else if (data?.product_name) {
        checks[idx] = {
          check: 'Endpoint Test',
          status: 'pass',
          message: `Found: ${data.product_name} → ${data.brand_name} (${latency}ms)`,
          latencyMs: latency
        };
      } else {
        checks[idx] = {
          check: 'Endpoint Test',
          status: 'warning',
          message: `Unexpected response (${latency}ms)`,
          latencyMs: latency
        };
      }
    } catch (err: any) {
      const latency = Math.round(performance.now() - t0);
      checks[idx] = {
        check: 'Endpoint Test',
        status: 'fail',
        message: `Network error: ${err.message}`,
        latencyMs: latency,
        error: err.stack || err.message
      };
    }

    setResults([...checks]);
    setRunning(false);
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'pending':
        return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
    }
  };

  const copyDebugReport = async () => {
    const report = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      results: results.map(r => ({
        check: r.check,
        status: r.status,
        message: r.message,
        latencyMs: r.latencyMs ?? null,
        error: r.error ?? null,
      }))
    };

    const text = JSON.stringify(report, null, 2);

    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Debug report copied to clipboard' });
    } catch {
      // Fallback: download JSON file
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scanner-debug-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Downloaded debug report (clipboard blocked)' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scanner Diagnostics</DialogTitle>
          <DialogDescription>
            Test camera access, permissions, and barcode resolution
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((result, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon(result.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{result.check}</div>
                    <div className="text-xs text-muted-foreground break-words">{result.message}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={runDiagnostics} 
              disabled={running}
              className="flex-1"
            >
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>Run Diagnostics</>
              )}
            </Button>
            {results.length > 0 && (
              <Button 
                onClick={copyDebugReport} 
                variant="outline"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy debug report
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
