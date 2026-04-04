import { useState, useEffect } from 'react';

function normalizeStoredLogoUrl(logoUrl: string | null) {
  if (!logoUrl) return null;
  const trimmed = logoUrl.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);

    if (url.hostname.includes('upload.wikimedia.org') && url.pathname.includes('/thumb/')) {
      const remainder = url.pathname.split('/thumb/')[1] || '';
      const parts = remainder.split('/').filter(Boolean);
      // Skip hash dirs (1-2 chars) and resolution variants (e.g. 200px-Logo.svg.png)
      const filename = parts.find(p => p.length > 2 && !/^\d+px-/.test(p));
      if (filename) {
        const normalizedFilename = encodeURIComponent(decodeURIComponent(filename).replace(/ /g, '_'));
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${normalizedFilename}`;
      }
    }

    if (url.hostname.includes('commons.wikimedia.org') && url.pathname.includes('/wiki/File:')) {
      const filename = url.pathname.split('/wiki/File:')[1];
      if (filename) {
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${filename}`;
      }
    }

    return trimmed;
  } catch {
    return logoUrl;
  }
}

export function useBrandLogo(logoUrl: string | null, website: string | null, brandName?: string | null) {
  const [fallbackLogo, setFallbackLogo] = useState<string | null>(null);
  const normalizedLogoUrl = normalizeStoredLogoUrl(logoUrl);

  useEffect(() => {
    if (normalizedLogoUrl || !website) {
      setFallbackLogo(null);
      return;
    }

    let domain = website.trim();
    if (!domain.startsWith('http')) {
      domain = 'https://' + domain;
    }

    try {
      const hostname = new URL(domain).hostname.replace(/^www\./, '');
      const favicon = `https://${hostname}/favicon.ico`;
      const img = new Image();
      img.onload = () => setFallbackLogo(favicon);
      img.onerror = () => {
        const ddg = `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
        const ddgImg = new Image();
        ddgImg.onload = () => setFallbackLogo(ddg);
        ddgImg.onerror = () => {
          if (brandName) {
            const clearbit = `https://logo.clearbit.com/${hostname}`;
            const clearbitImg = new Image();
            clearbitImg.onload = () => setFallbackLogo(clearbit);
            clearbitImg.onerror = () => setFallbackLogo(null);
            clearbitImg.src = clearbit;
          } else {
            setFallbackLogo(null);
          }
        };
        ddgImg.src = ddg;
      };
      img.src = favicon;
    } catch {
      setFallbackLogo(null);
    }
  }, [normalizedLogoUrl, website, brandName]);

  return normalizedLogoUrl || fallbackLogo;
}
