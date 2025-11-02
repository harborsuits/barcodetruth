import { useState, useEffect } from 'react';

/**
 * Client-side logo fallback - tries free sources instantly
 * while batch job persists logos nightly
 */
export function useBrandLogo(logoUrl: string | null, website: string | null, brandName?: string | null) {
  const [fallbackLogo, setFallbackLogo] = useState<string | null>(null);

  useEffect(() => {
    if (logoUrl || !website) {
      setFallbackLogo(null);
      return;
    }

    // Normalize domain
    let domain = website.trim();
    if (!domain.startsWith('http')) {
      domain = 'https://' + domain;
    }
    
    try {
      const hostname = new URL(domain).hostname.replace(/^www\./, '');
      
      // Try favicon first (fast, often works)
      const favicon = `https://${hostname}/favicon.ico`;
      const img = new Image();
      img.onload = () => setFallbackLogo(favicon);
      img.onerror = () => {
        // Try DuckDuckGo first
        const ddgImg = new Image();
        ddgImg.onload = () => setFallbackLogo(`https://icons.duckduckgo.com/ip3/${hostname}.ico`);
        ddgImg.onerror = () => {
          // Final fallback - try Clearbit if we have a brand name
          if (brandName) {
            const clearbitImg = new Image();
            clearbitImg.onload = () => setFallbackLogo(`https://logo.clearbit.com/${hostname}`);
            clearbitImg.onerror = () => setFallbackLogo(null);
            clearbitImg.src = `https://logo.clearbit.com/${hostname}`;
          }
        };
        ddgImg.src = `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
      };
      img.src = favicon;
    } catch {
      setFallbackLogo(null);
    }
  }, [logoUrl, website, brandName]);

  return logoUrl || fallbackLogo;
}
