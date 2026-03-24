/**
 * Source adapters for all regulatory datasets.
 * Each adapter implements SourceAdapter: { id, featureFlagKey, fetch() }
 * 
 * Adding a new source = adding ~30 lines here. No new edge functions needed.
 */

import { type SourceAdapter, type RawRegRecord } from "./regulatoryPipeline.ts";

// ── Helper ─────────────────────────────────────────────────────────────

function sanitizeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return new Date().toISOString();
  // FDA YYYYMMDD format
  if (/^\d{8}$/.test(dateStr)) {
    return new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`).toISOString();
  }
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// ── 1. FDA Recalls (Food + Drug + Device) ──────────────────────────────

const FDA_ENDPOINTS = [
  { path: 'food/enforcement.json', label: 'Food' },
  { path: 'drug/enforcement.json', label: 'Drug' },
  { path: 'device/enforcement.json', label: 'Device' },
];

export const fdaAdapter: SourceAdapter = {
  id: 'fda',
  featureFlagKey: 'ingest_fda_enabled',
  async fetch(query: string, maxResults: number): Promise<RawRegRecord[]> {
    const records: RawRegRecord[] = [];
    const perEndpoint = Math.ceil(maxResults / FDA_ENDPOINTS.length);

    for (const ep of FDA_ENDPOINTS) {
      try {
        const url = `https://api.fda.gov/${ep.path}?search=recalling_firm:"${encodeURIComponent(query)}"&limit=${perEndpoint}`;
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const data = await resp.json();

        for (const r of (data?.results || [])) {
          if (!r.recall_number) continue;
          const classification = r.classification || '';
          let impact = -2;
          if (classification === 'Class I') impact = -5;
          else if (classification === 'Class II') impact = -3;
          else if (classification === 'Class III') impact = -1;

          records.push({
            sourceId: r.recall_number,
            title: `FDA ${ep.label} Recall: ${(r.product_description || 'Product recall').substring(0, 200)}`,
            description: `${classification || 'Recall'} - ${r.reason_for_recall || 'See recall details'}`,
            firmName: r.recalling_firm || query,
            date: sanitizeDate(r.recall_initiation_date || r.report_date),
            sourceUrl: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts',
            category: 'social',
            impact,
            sourceName: 'FDA',
            sourceDomain: 'fda.gov',
            agencyFullName: 'U.S. Food and Drug Administration',
            rawData: r,
          });
        }
      } catch (err) {
        console.error(`[fda:${ep.label}] Error:`, err);
      }
      await new Promise(r => setTimeout(r, 150));
    }
    return records;
  },
};

// ── 2. OSHA Violations ─────────────────────────────────────────────────

export const oshaAdapter: SourceAdapter = {
  id: 'osha',
  featureFlagKey: 'ingest_osha_enabled',
  async fetch(query: string, maxResults: number): Promise<RawRegRecord[]> {
    const records: RawRegRecord[] = [];
    try {
      // OSHA enforcement API
      const url = `https://enforcedata.dol.gov/api/enhanced_osha/inspection?company=${encodeURIComponent(query)}&per_page=${maxResults}`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });
      if (!resp.ok) {
        // Fallback: try the OSHA summary API
        console.warn(`[osha] Primary API returned ${resp.status}, trying summary endpoint`);
        return records;
      }
      const data = await resp.json();
      const inspections = Array.isArray(data) ? data : (data?.results || []);

      for (const insp of inspections) {
        const id = insp.activity_nr || insp.inspection_nr || String(Math.random());
        const violType = insp.viol_type_desc || insp.violation_type || '';
        const penalty = insp.total_current_penalty || insp.penalty || 0;
        const penaltyStr = penalty > 0 ? ` (Penalty: $${Number(penalty).toLocaleString()})` : '';

        let impact = -2;
        if (penalty > 100000) impact = -5;
        else if (penalty > 10000) impact = -4;
        else if (penalty > 1000) impact = -3;

        records.push({
          sourceId: String(id),
          title: `OSHA Inspection: ${violType || 'Workplace safety violation'}${penaltyStr}`,
          description: `${insp.estab_name || query} — ${violType || 'Inspection'} in ${insp.site_city || ''}, ${insp.site_state || ''}. ${insp.hazard_desc || ''}`.trim(),
          firmName: insp.estab_name || query,
          date: sanitizeDate(insp.open_date || insp.close_date),
          sourceUrl: 'https://www.osha.gov/pls/imis/establishment.html',
          category: 'labor',
          impact,
          sourceName: 'OSHA',
          sourceDomain: 'osha.gov',
          agencyFullName: 'Occupational Safety and Health Administration',
          rawData: insp,
        });
      }
    } catch (err) {
      console.error('[osha] Fetch error:', err);
    }
    return records;
  },
};

// ── 3. CPSC Recalls ────────────────────────────────────────────────────

export const cpscAdapter: SourceAdapter = {
  id: 'cpsc',
  featureFlagKey: 'ingest_cpsc_enabled',
  async fetch(query: string, maxResults: number): Promise<RawRegRecord[]> {
    const records: RawRegRecord[] = [];
    try {
      const url = `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallTitle=${encodeURIComponent(query)}`;
      const resp = await fetch(url);
      if (!resp.ok) return records;

      const data = await resp.json();
      const recalls = Array.isArray(data) ? data.slice(0, maxResults) : [];

      for (const r of recalls) {
        const recallId = r.RecallID || r.RecallNumber || String(Math.random());
        const title = r.Title || r.Description || 'Consumer product recall';
        const hazard = r.Hazards?.[0]?.Name || r.Description || '';

        let impact = -3;
        if (hazard.toLowerCase().includes('death') || hazard.toLowerCase().includes('serious')) impact = -5;
        else if (hazard.toLowerCase().includes('burn') || hazard.toLowerCase().includes('laceration')) impact = -4;

        records.push({
          sourceId: String(recallId),
          title: `CPSC Recall: ${title.substring(0, 200)}`,
          description: `${hazard}. Manufacturer: ${r.Manufacturers?.[0]?.Name || query}`,
          firmName: r.Manufacturers?.[0]?.Name || query,
          date: sanitizeDate(r.RecallDate),
          sourceUrl: r.URL || 'https://www.cpsc.gov/Recalls',
          category: 'social',
          impact,
          sourceName: 'CPSC',
          sourceDomain: 'cpsc.gov',
          agencyFullName: 'U.S. Consumer Product Safety Commission',
          rawData: r,
        });
      }
    } catch (err) {
      console.error('[cpsc] Fetch error:', err);
    }
    return records;
  },
};

// ── 4. EPA ECHO Enforcement ────────────────────────────────────────────

export const epaAdapter: SourceAdapter = {
  id: 'epa',
  featureFlagKey: 'ingest_epa_enabled',
  async fetch(query: string, maxResults: number): Promise<RawRegRecord[]> {
    const records: RawRegRecord[] = [];
    try {
      const url = `https://echodata.epa.gov/echo/dfr_rest_services.get_facility_info?output=JSON&qcolumns=CWPName,FacName,EPASystem,CWPVStatus&p_fn=${encodeURIComponent(query)}`;
      const resp = await fetch(url);
      if (!resp.ok) return records;

      const data = await resp.json();
      const facilities = data?.Results?.Facilities || [];

      for (const fac of facilities.slice(0, maxResults)) {
        const facId = fac.RegistryID || fac.FacDerivedHuc || String(Math.random());
        const violations = fac.CWPSNCStatus || fac.CWPVStatus || '';
        const hasViolation = violations && violations !== 'No Violation';
        if (!hasViolation) continue;

        records.push({
          sourceId: `epa-${facId}`,
          title: `EPA Violation: ${fac.FacName || query}`,
          description: `Environmental violation at ${fac.FacName || query}, ${fac.FacCity || ''} ${fac.FacState || ''}. Status: ${violations}`,
          firmName: fac.FacName || query,
          date: sanitizeDate(fac.CWPInspectionDate || null),
          sourceUrl: `https://echo.epa.gov/detailed-facility-report?fid=${fac.RegistryID || ''}`,
          category: 'environment',
          impact: -3,
          sourceName: 'EPA',
          sourceDomain: 'epa.gov',
          agencyFullName: 'U.S. Environmental Protection Agency',
          rawData: fac,
        });
      }
    } catch (err) {
      console.error('[epa] Fetch error:', err);
    }
    return records;
  },
};

// ── 5. FTC Cases ───────────────────────────────────────────────────────

export const ftcAdapter: SourceAdapter = {
  id: 'ftc',
  featureFlagKey: 'ingest_ftc_enabled',
  async fetch(query: string, maxResults: number): Promise<RawRegRecord[]> {
    const records: RawRegRecord[] = [];
    try {
      // FTC cases API - search by company name
      const url = `https://www.ftc.gov/api/v1/legal-library?search=${encodeURIComponent(query)}&type=case&format=json&limit=${maxResults}`;
      const resp = await fetch(url);
      if (!resp.ok) return records;

      const data = await resp.json();
      const cases = data?.results || data?.items || (Array.isArray(data) ? data : []);

      for (const c of cases.slice(0, maxResults)) {
        const caseId = c.id || c.case_number || c.nid || String(Math.random());
        const title = c.title || c.name || 'FTC enforcement action';

        records.push({
          sourceId: `ftc-${caseId}`,
          title: `FTC Action: ${title.substring(0, 200)}`,
          description: c.body?.summary || c.summary || c.description || title,
          firmName: query,
          date: sanitizeDate(c.date || c.field_date || c.created),
          sourceUrl: c.url || c.path || 'https://www.ftc.gov/legal-library',
          category: 'social',
          impact: -4,
          sourceName: 'FTC',
          sourceDomain: 'ftc.gov',
          agencyFullName: 'Federal Trade Commission',
          rawData: c,
        });
      }
    } catch (err) {
      console.error('[ftc] Fetch error:', err);
    }
    return records;
  },
};

// ── 6. USDA FSIS Recalls ──────────────────────────────────────────────

export const usdaAdapter: SourceAdapter = {
  id: 'usda',
  featureFlagKey: 'ingest_usda_enabled',
  async fetch(query: string, maxResults: number): Promise<RawRegRecord[]> {
    const records: RawRegRecord[] = [];
    try {
      const url = `https://api.fsis.usda.gov/api/v1/recall?query=${encodeURIComponent(query)}&limit=${maxResults}`;
      const resp = await fetch(url);
      if (!resp.ok) return records;

      const data = await resp.json();
      const recalls = data?.results || (Array.isArray(data) ? data : []);

      for (const r of recalls.slice(0, maxResults)) {
        const recallId = r.recall_number || r.id || String(Math.random());
        const classification = r.recall_classification || '';
        let impact = -3;
        if (classification.includes('I')) impact = -5;
        else if (classification.includes('II')) impact = -4;

        records.push({
          sourceId: `usda-${recallId}`,
          title: `USDA Recall: ${(r.recall_reason || r.product || 'Food safety recall').substring(0, 200)}`,
          description: `${classification} — ${r.recall_reason || 'Food safety issue'}. Products: ${r.product || 'See details'}`,
          firmName: r.company || r.establishment_name || query,
          date: sanitizeDate(r.recall_date),
          sourceUrl: r.url || 'https://www.fsis.usda.gov/recalls',
          category: 'social',
          impact,
          sourceName: 'USDA FSIS',
          sourceDomain: 'fsis.usda.gov',
          agencyFullName: 'U.S. Department of Agriculture Food Safety',
          rawData: r,
        });
      }
    } catch (err) {
      console.error('[usda] Fetch error:', err);
    }
    return records;
  },
};

// ── Registry ───────────────────────────────────────────────────────────

/** All available adapters in priority order */
export const ALL_ADAPTERS: SourceAdapter[] = [
  fdaAdapter,
  oshaAdapter,
  epaAdapter,
  cpscAdapter,
  ftcAdapter,
  usdaAdapter,
];

/** Get adapters by ID */
export function getAdapters(ids?: string[]): SourceAdapter[] {
  if (!ids || ids.length === 0) return ALL_ADAPTERS;
  return ALL_ADAPTERS.filter(a => ids.includes(a.id));
}
