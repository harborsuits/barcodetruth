let deferredPrompt: any = null;

export function initA2HS() {
  window.addEventListener('beforeinstallprompt', (e: any) => {
    console.log('[A2HS] Install prompt available');
    e.preventDefault();
    deferredPrompt = e;
    localStorage.setItem('a2hs-available', '1');
  });
}

export async function triggerA2HS() {
  if (!deferredPrompt) {
    console.log('[A2HS] No prompt available');
    return false;
  }
  
  console.log('[A2HS] Showing install prompt');
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log('[A2HS] User choice:', outcome);
  
  deferredPrompt = null;
  localStorage.removeItem('a2hs-available');
  return outcome === 'accepted';
}

export function isA2HSAvailable() {
  return localStorage.getItem('a2hs-available') === '1';
}

export function dismissA2HS() {
  localStorage.setItem('a2hs-dismissed', '1');
}

export function isA2HSDismissed() {
  return localStorage.getItem('a2hs-dismissed') === '1';
}
