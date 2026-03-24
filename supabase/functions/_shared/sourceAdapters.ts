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

// ── 2. OSHA Violations (live query + historical bulk) ──────────────────

export const oshaAdapter: SourceAdapter = {
  id: 'osha',
  featureFlagKey: 'ingest_osha_enabled',
  async fetch(query: string, maxResults: number): Promise<RawRegRecord[]> {
    const records: RawRegRecord[] = [];
    try {
      // OSHA enforcement API — live query by establishment name
      const url = `https://enforcedata.dol.gov/api/enhanced_osha/inspection?company=${encodeURIComponent(query)}&per_page=${maxResults}`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });
      if (!resp.ok) {
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
          sourceUrl: `https://www.osha.gov/pls/imis/establishment.inspection_detail?id=${id}`,
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

// ── 2b. OSHA Historical Bulk (paginated archive ingestion) ─────────────
// This adapter is used by bulk-ingest-osha-historical for discovery mode.
// It pulls pages of inspections without filtering by company name,
// then relies on the company matcher to resolve establishment names.

export const oshaHistoricalAdapter: SourceAdapter = {
  id: 'osha-historical',
  featureFlagKey: 'ingest_osha_historical_enabled',
  async fetch(query: string, maxResults: number): Promise<RawRegRecord[]> {
    const records: RawRegRecord[] = [];
    try {
      // query is used as a date-range or SIC filter in bulk mode
      // Format: "page=0&start=2020-01-01&end=2025-12-31" or just a company name
      const params = new URLSearchParams(query);
      const page = params.get('page') || '0';
      const startDate = params.get('start') || '2020-01-01';
      const endDate = params.get('end') || new Date().toISOString().slice(0, 10);
      const sicCode = params.get('sic') || '';

      const apiParams = new URLSearchParams({
        per_page: String(Math.min(maxResults, 250)),
        page,
        open_date_from: startDate,
        open_date_to: endDate,
      });
      if (sicCode) apiParams.set('sic_code', sicCode);

      const url = `https://enforcedata.dol.gov/api/enhanced_osha/inspection?${apiParams.toString()}`;
      const resp = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!resp.ok) return records;

      const raw = await resp.json();
      const inspections = Array.isArray(raw) ? raw : raw?.results || raw?.data || [];

      for (const insp of inspections) {
        const id = insp.activity_nr || insp.inspection_nr || '';
        if (!id) continue;
        const firmName = (insp.estab_name || '').toString().trim();
        if (!firmName) continue;

        const penalty = Number(insp.total_current_penalty || 0);
        const serious = Number(insp.nr_serious || 0);
        const willful = Number(insp.nr_willful || 0);
        const repeat_ = Number(insp.nr_repeat || 0);
        const violCount = serious + willful + repeat_;

        let impact = -1;
        if (willful >= 2 || penalty >= 100_000) impact = -5;
        else if (repeat_ >= 1 || willful >= 1) impact = -4;
        else if (serious >= 3 || penalty >= 25_000) impact = -3;
        else if (serious >= 1) impact = -2;

        const penaltyStr = penalty > 0 ? ` ($${Number(penalty).toLocaleString()})` : '';

        records.push({
          sourceId: String(id),
          title: `OSHA Inspection: ${violCount} violation${violCount !== 1 ? 's' : ''} at ${firmName.substring(0, 80)}${penaltyStr}`,
          description: `OSHA inspection of ${firmName} in ${insp.site_city || ''}, ${insp.site_state || ''}. ${violCount} violation(s)${serious > 0 ? `, ${serious} serious` : ''}${willful > 0 ? `, ${willful} willful` : ''}.`.trim(),
          firmName,
          date: sanitizeDate(insp.close_case_date || insp.open_date),
          sourceUrl: `https://www.osha.gov/pls/imis/establishment.inspection_detail?id=${id}`,
          category: 'labor',
          impact,
          sourceName: 'OSHA',
          sourceDomain: 'osha.gov',
          agencyFullName: 'Occupational Safety and Health Administration',
          rawData: insp,
        });
      }
    } catch (err) {
      console.error('[osha-historical] Fetch error:', err);
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

// ── 7. EU Safety Gate (RAPEX) ──────────────────────────────────────────
// The Safety Gate is an Angular SPA without a stable public REST API.
// We use the weekly XML/JSON data dumps published on the Safety Gate portal.
// Primary: Safety Gate weekly report XML feed
// Fallback: OECD GlobalRecalls API

export const rapexAdapter: SourceAdapter = {
  id: 'rapex',
  featureFlagKey: 'ingest_rapex_enabled',
  async fetch(query: string, maxResults: number): Promise<RawRegRecord[]> {
    // Try the Safety Gate weekly report feed first
    const records = await rapexWeeklyFeed(query, maxResults);
    if (records.length > 0) return records;

    // Fallback: OECD GlobalRecalls
    return await rapexOecdFallback(query, maxResults);
  },
};

/** Fetch from Safety Gate weekly XML reports published as open data */
async function rapexWeeklyFeed(query: string, maxResults: number): Promise<RawRegRecord[]> {
  const records: RawRegRecord[] = [];
  try {
    // The Safety Gate publishes weekly XML reports; parse the latest
    // Also available as CSV from https://ec.europa.eu/safety-gate-alerts/screen/webReport
    // Using the weekly overview JSON endpoint
    const url = 'https://ec.europa.eu/safety-gate-alerts/screen/webReport/alertDetail/latestWeeklyOverview';
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json, text/html, */*' },
    });

    if (!resp.ok) {
      console.warn(`[rapex] Weekly feed returned ${resp.status}`);
      return records;
    }

    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { return records; }

    const alerts = data?.alerts || data?.results || data?.items || (Array.isArray(data) ? data : []);
    const queryLower = query.toLowerCase();

    for (const alert of alerts) {
      const productName = (alert.productName || alert.product || alert.title || '').toString();
      const companyName = (alert.companyName || alert.brand || alert.manufacturer || '').toString();
      const description = (alert.description || alert.hazardType || alert.type_of_risk || '').toString();

      // Filter by query term
      const searchable = `${productName} ${companyName} ${description}`.toLowerCase();
      if (!searchable.includes(queryLower)) continue;

      const alertId = alert.alertNumber || alert.reference || alert.id || String(Math.random());
      const riskLevel = (alert.riskLevel || alert.risk_level || '').toString().toLowerCase();

      let impact = -3;
      if (riskLevel.includes('serious')) impact = -5;
      else if (riskLevel.includes('high')) impact = -4;
      else if (riskLevel.includes('low')) impact = -1;

      const hazardType = alert.hazardType || alert.type_of_risk || alert.riskType || '';
      const notifyingCountry = alert.notifyingCountry || alert.country || '';

      records.push({
        sourceId: `rapex-${alertId}`,
        title: `EU Safety Gate: ${productName.substring(0, 200)}`,
        description: `${hazardType} risk. ${alert.measures || alert.actionTaken || 'Recall/withdrawal'}. Notified by: ${notifyingCountry}`,
        firmName: companyName || query,
        date: sanitizeDate(alert.date || alert.notificationDate || alert.publicationDate),
        sourceUrl: alert.url || `https://ec.europa.eu/safety-gate-alerts/screen/webReport/alertDetail/${alertId}`,
        category: hazardType.toString().toLowerCase().includes('chemical') ? 'environment' : 'social',
        impact,
        sourceName: 'EU Safety Gate',
        sourceDomain: 'ec.europa.eu',
        agencyFullName: 'European Commission Safety Gate (RAPEX)',
        rawData: alert,
      });

      if (records.length >= maxResults) break;
    }
  } catch (err) {
    console.error('[rapex] Weekly feed error:', err);
  }
  return records;
}

/** OECD GlobalRecalls fallback for RAPEX data */
async function rapexOecdFallback(query: string, maxResults: number): Promise<RawRegRecord[]> {
  const records: RawRegRecord[] = [];
  try {
    const url = `https://globalrecalls.oecd.org/api/recalls?search=${encodeURIComponent(query)}&country=EU&format=json&limit=${maxResults}`;
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!resp.ok) return records;

    const data = await resp.json();
    const recalls = data?.recalls || data?.results || (Array.isArray(data) ? data : []);

    for (const r of recalls.slice(0, maxResults)) {
      const recallId = r.id || r.recall_id || String(Math.random());

      records.push({
        sourceId: `rapex-oecd-${recallId}`,
        title: `EU Recall: ${(r.title || r.product || 'Consumer product recall').substring(0, 200)}`,
        description: `${r.hazard || r.risk || 'Safety concern'}. ${r.measure || ''}`,
        firmName: r.manufacturer || r.brand || query,
        date: sanitizeDate(r.date || r.notification_date),
        sourceUrl: r.url || 'https://globalrecalls.oecd.org/',
        category: 'social',
        impact: -3,
        sourceName: 'OECD GlobalRecalls (EU)',
        sourceDomain: 'globalrecalls.oecd.org',
        agencyFullName: 'OECD Global Recalls Portal — EU',
        rawData: r,
      });
    }
  } catch (err) {
    console.error('[rapex-oecd] Fallback error:', err);
  }
  return records;
}

// ── 8. SEC EDGAR Exhibit 21 (Subsidiary Lists) ────────────────────────

/**
 * SEC EDGAR full-text search for Exhibit 21 filings (subsidiary lists).
 * These filings list ALL subsidiaries of a public corporation.
 * This is the single highest-yield dataset for corporate graph expansion.
 * 
 * Each subsidiary becomes a potential brand match or company_ownership link.
 */
export const secEdgar21Adapter: SourceAdapter = {
  id: 'sec-exhibit-21',
  featureFlagKey: 'ingest_sec_exhibit_21_enabled',
  async fetch(query: string, maxResults: number): Promise<RawRegRecord[]> {
    const records: RawRegRecord[] = [];
    try {
      // EDGAR full-text search for Exhibit 21 filings mentioning the company
      const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(query)}%22&dateRange=custom&startdt=2020-01-01&forms=EX-21&from=0&size=${Math.min(maxResults, 40)}`;
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'BarcodeTrauth/1.0 (compliance@barcodetruth.com)',
          'Accept': 'application/json',
        },
      });
      if (!resp.ok) {
        // Fallback: EDGAR company search API
        return await secEdgarCompanyFallback(query, maxResults);
      }
      const data = await resp.json();
      const hits = data?.hits?.hits || [];

      for (const hit of hits.slice(0, maxResults)) {
        const filing = hit._source || {};
        const cik = filing.entity_id || filing.cik || '';
        const companyName = filing.entity_name || filing.display_names?.[0] || query;
        const filingDate = filing.file_date || filing.period_of_report || '';
        const accession = filing.file_num || filing.accession_no || '';

        records.push({
          sourceId: `sec-ex21-${cik}-${accession}-${filingDate}`,
          title: `SEC Exhibit 21: ${companyName} subsidiary disclosure`,
          description: `Annual subsidiary list filing by ${companyName}. Exhibit 21 lists all significant subsidiaries and their jurisdictions of incorporation.`,
          firmName: companyName,
          date: sanitizeDate(filingDate),
          sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=EX-21`,
          category: 'politics', // corporate governance
          impact: 0, // neutral — structural data, not violations
          sourceName: 'SEC EDGAR',
          sourceDomain: 'sec.gov',
          agencyFullName: 'U.S. Securities and Exchange Commission',
          rawData: { cik, companyName, filingDate, accession, type: 'exhibit-21' },
        });
      }
    } catch (err) {
      console.error('[sec-exhibit-21] Error:', err);
    }
    return records;
  },
};

async function secEdgarCompanyFallback(query: string, maxResults: number): Promise<RawRegRecord[]> {
  const records: RawRegRecord[] = [];
  try {
    const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(query)}%22+%22exhibit+21%22&from=0&size=${Math.min(maxResults, 20)}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'BarcodeTrauth/1.0 (compliance@barcodetruth.com)',
        'Accept': 'application/json',
      },
    });
    if (!resp.ok) return records;
    const data = await resp.json();

    for (const hit of (data?.hits?.hits || []).slice(0, maxResults)) {
      const filing = hit._source || {};
      records.push({
        sourceId: `sec-ex21-fallback-${filing.accession_no || Math.random()}`,
        title: `SEC Filing: ${filing.entity_name || query} — Exhibit 21`,
        description: `Subsidiary disclosure filing for ${filing.entity_name || query}`,
        firmName: filing.entity_name || query,
        date: sanitizeDate(filing.file_date),
        sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${filing.entity_id || ''}&type=EX-21`,
        category: 'politics',
        impact: 0,
        sourceName: 'SEC EDGAR',
        sourceDomain: 'sec.gov',
        agencyFullName: 'U.S. Securities and Exchange Commission',
        rawData: filing,
      });
    }
  } catch (err) {
    console.error('[sec-exhibit-21] Fallback error:', err);
  }
  return records;
}

// ── Registry ───────────────────────────────────────────────────────────

/** All available adapters in priority order */
export const ALL_ADAPTERS: SourceAdapter[] = [
  fdaAdapter,
  oshaAdapter,
  epaAdapter,
  cpscAdapter,
  ftcAdapter,
  usdaAdapter,
  rapexAdapter,
  secEdgar21Adapter,
];

/** Get adapters by ID */
export function getAdapters(ids?: string[]): SourceAdapter[] {
  if (!ids || ids.length === 0) return ALL_ADAPTERS;
  return ALL_ADAPTERS.filter(a => ids.includes(a.id));
}
