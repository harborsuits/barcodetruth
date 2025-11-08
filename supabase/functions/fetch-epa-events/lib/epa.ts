import { RELEVANCE_MAX_SCORE } from "../../_shared/scoringConstants.ts";

export interface EPAFacility {
  RegistryID: string;
  FacName: string;
  Viol_Flag: string;
  Qtrs_with_NC: number;
  FacLat?: string;
  FacLong?: string;
  FacCity?: string;
  FacState?: string;
}

export interface EPASearchResult {
  Results?: {
    Results?: EPAFacility[];
  };
}

export interface InternalEvent {
  brand_id: string;
  title: string;
  description: string;
  category: string;
  event_date: string;
  verification: string;
  orientation: string;
  impact_environment: number;
  source_url: string;
  relevance_score_raw: number;
  is_irrelevant: boolean;
}

/**
 * Build primary EPA ECHO API URL
 */
export function buildPrimaryUrl(companyName: string): string {
  return `https://echodata.epa.gov/echo/rest_lookups.get_facilities?output=JSON&p_fn=${encodeURIComponent(companyName)}&responseset=20`;
}

/**
 * Build fallback EPA Envirofacts URL
 */
export function buildFallbackUrl(companyName: string): string {
  // Envirofacts facility search by name
  return `https://data.epa.gov/efservice/FRS_FACILITIES/PRIMARY_NAME/${encodeURIComponent(companyName)}/ROWS/0:20/JSON`;
}

/**
 * Parse EPA ECHO response
 */
export function parseEchoResponse(json: any): EPAFacility[] {
  return json?.Results?.Results ?? [];
}

/**
 * Parse EPA Envirofacts response
 */
export function parseEnvirofactsResponse(json: any): EPAFacility[] {
  if (!Array.isArray(json)) return [];
  
  // Convert Envirofacts format to our internal format
  return json.map((item: any) => ({
    RegistryID: item.REGISTRY_ID || item.registry_id || '',
    FacName: item.PRIMARY_NAME || item.primary_name || '',
    Viol_Flag: item.HAS_VIOLATION || item.has_violation ? 'Y' : 'N',
    Qtrs_with_NC: 0, // Envirofacts doesn't provide this directly
    FacCity: item.CITY_NAME || item.city_name,
    FacState: item.STATE_CODE || item.state_code,
  }));
}

/**
 * Convert EPA facility to internal event format
 */
export function toInternalEvent(
  facility: EPAFacility,
  brandId: string
): InternalEvent {
  const qnc = Number(facility.Qtrs_with_NC ?? 0) || 0;
  const impact = qnc > 2 ? -5 : qnc > 0 ? -3 : -1;
  
  const sourceUrl = `https://echo.epa.gov/detailed-facility-report?fid=${facility.RegistryID}`;
  
  const location = [facility.FacCity, facility.FacState]
    .filter(Boolean)
    .join(', ');
  
  const locationStr = location ? ` in ${location}` : '';
  
  return {
    brand_id: brandId,
    title: `EPA violation at ${facility.FacName}${locationStr}`,
    description: `Facility ${facility.RegistryID} reported ${facility.Qtrs_with_NC ?? 0} quarters with non-compliance. ${facility.Viol_Flag === 'Y' ? 'Active violations flagged.' : 'Monitoring required.'}`,
    category: 'environment',
    event_date: new Date().toISOString(),
    verification: 'official',
    orientation: 'negative',
    impact_environment: impact,
    source_url: sourceUrl,
    relevance_score_raw: RELEVANCE_MAX_SCORE,
    is_irrelevant: false,
  };
}

/**
 * Create event source metadata
 */
export function createEventSource(
  eventId: string,
  facility: EPAFacility,
  sourceUrl: string
) {
  const registrableDomain = (() => {
    try {
      const u = new URL(sourceUrl);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return 'epa.gov';
    }
  })();

  const sourceTitle = (facility.FacName || 'Facility').trim();
  const safeTitle = sourceTitle.length >= 4 
    ? `EPA action at ${sourceTitle}` 
    : 'EPA enforcement record';

  return {
    event_id: eventId,
    source_name: 'EPA',
    title: safeTitle,
    source_url: sourceUrl,
    canonical_url: sourceUrl,
    domain_owner: 'U.S. Environmental Protection Agency',
    registrable_domain: registrableDomain,
    domain_kind: 'official',
    source_date: new Date().toISOString(),
    is_primary: true,
    link_kind: 'database',
    article_snippet: `Facility: ${facility.FacName}, Registry ID: ${facility.RegistryID}`,
  };
}
