/**
 * Logo resolution helpers - tries free sources first, then paid
 */

export interface LogoResult {
  url: string;
  source: 'favicon' | 'duckduckgo' | 'wikimedia' | 'clearbit';
  etag?: string;
  contentType?: string;
}

/**
 * Normalize domain URL - add https:// if missing, remove www
 */
export function normalizeDomain(url: string | null): string | null {
  if (!url) return null;
  
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  
  try {
    const parsed = new URL(normalized);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Try to fetch favicon from the site directly
 */
export async function tryFavicon(domain: string): Promise<LogoResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`https://${domain}/favicon.ico`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.startsWith('image/')) {
      return {
        url: `https://${domain}/favicon.ico`,
        source: 'favicon',
        etag: response.headers.get('etag') || undefined,
        contentType,
      };
    }
  } catch (err) {
    // Favicon not available, try next option
  }
  return null;
}

/**
 * Try DuckDuckGo's free favicon service
 */
export async function tryDDG(domain: string): Promise<LogoResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`https://icons.duckduckgo.com/ip3/${domain}.ico`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    if (response.ok) {
      return {
        url: `https://icons.duckduckgo.com/ip3/${domain}.ico`,
        source: 'duckduckgo',
        contentType: 'image/x-icon',
      };
    }
  } catch (err) {
    // DDG not available
  }
  return null;
}

/**
 * Try Wikimedia Commons via Wikidata QID
 */
export async function tryWikimedia(wikidataQid: string | null): Promise<LogoResult | null> {
  if (!wikidataQid) return null;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${wikidataQid}.json`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const entity = data.entities[wikidataQid];
    const logoProperty = entity?.claims?.P154; // P154 is the logo image property
    
    if (logoProperty && logoProperty.length > 0) {
      const filename = logoProperty[0].mainsnak?.datavalue?.value;
      if (filename) {
        const encodedFilename = encodeURIComponent(filename.replace(/ /g, '_'));
        const commonsUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodedFilename}`;
        
        // Verify it's actually an image
        const headController = new AbortController();
        const headTimeout = setTimeout(() => headController.abort(), 5000);
        const headResp = await fetch(commonsUrl, { 
          method: 'HEAD',
          signal: headController.signal 
        });
        clearTimeout(headTimeout);
        
        const contentType = headResp.headers.get('content-type') || '';
        if (headResp.ok && contentType.startsWith('image/')) {
          return {
            url: commonsUrl,
            source: 'wikimedia',
            contentType,
          };
        }
      }
    }
  } catch (err) {
    // Wikimedia not available
  }
  return null;
}

/**
 * Try Clearbit (only if you have ToS approval)
 */
export async function tryClearbit(domain: string): Promise<LogoResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const clearbitUrl = `https://logo.clearbit.com/${domain}`;
    const response = await fetch(clearbitUrl, { 
      method: 'HEAD',
      signal: controller.signal 
    });
    clearTimeout(timeout);
    
    if (response.ok) {
      return {
        url: clearbitUrl,
        source: 'clearbit',
        contentType: response.headers.get('content-type') || 'image/png',
      };
    } else if (response.status === 403) {
      // Clearbit sometimes blocks HEAD, try GET with Range
      const rangeController = new AbortController();
      const rangeTimeout = setTimeout(() => rangeController.abort(), 5000);
      
      const rangeResp = await fetch(clearbitUrl, {
        headers: { 'Range': 'bytes=0-0' },
        signal: rangeController.signal
      });
      clearTimeout(rangeTimeout);
      
      if (rangeResp.ok || rangeResp.status === 206) {
        return {
          url: clearbitUrl,
          source: 'clearbit',
          contentType: 'image/png',
        };
      }
    }
  } catch (err) {
    // Clearbit not available
  }
  return null;
}

/**
 * Upload logo to Supabase Storage
 */
export async function uploadLogoToStorage(
  supabase: any,
  brandId: string,
  logoUrl: string,
  etag?: string
): Promise<{ publicUrl: string } | null> {
  try {
    // Fetch the actual image
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    
    const blob = await response.blob();
    const extension = logoUrl.endsWith('.svg') ? 'svg' : 
                     logoUrl.endsWith('.png') ? 'png' : 
                     logoUrl.endsWith('.jpg') || logoUrl.endsWith('.jpeg') ? 'jpg' : 'ico';
    
    const fileName = `${brandId}.${extension}`;
    
    // Upload to brand-logos bucket
    const { error: uploadError } = await supabase.storage
      .from('brand-logos')
      .upload(fileName, blob, {
        contentType: blob.type,
        upsert: true, // Replace if exists
        cacheControl: '86400', // Cache for 1 day
      });
    
    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return null;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('brand-logos')
      .getPublicUrl(fileName);
    
    return { publicUrl };
  } catch (err) {
    console.error('Upload to storage failed:', err);
    return null;
  }
}
