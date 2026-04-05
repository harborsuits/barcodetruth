import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Name normalization ───
const CORP_SUFFIXES = /[,.]?\s+(?:inc|incorporated|corp|corporation|co|company|llc|ltd|limited|plc|gmbh|sa|ag|nv|holdings|group|brands|foods|beverages|international|global|worldwide|enterprises)\.?$/i;

function normalizeName(raw: string): string {
  let name = raw.trim();
  // Strip leading "The "
  name = name.replace(/^the\s+/i, '');
  // Strip corporate suffixes (up to 3 passes for stacked suffixes)
  for (let i = 0; i < 3; i++) name = name.replace(CORP_SUFFIXES, '');
  // Fix comma-joined like "Classico,New World Pasta Company"
  if (name.includes(',')) {
    const parts = name.split(',').map(s => s.trim()).filter(Boolean);
    name = parts[0]; // Take the brand part, not the parent corp
  }
  // Title case
  name = name.replace(/\b\w+/g, w => {
    if (['and', 'or', 'the', 'of', 'in', 'for'].includes(w.toLowerCase())) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
  // Fix known brand stylings
  name = name.replace(/\bmccain\b/i, 'McCain')
    .replace(/\bmcdonald/i, "McDonald")
    .replace(/\bq tips\b/i, 'Q-Tips')
    .replace(/\bjohnson & johnson\b/i, 'Johnson & Johnson');
  return name.trim();
}

// ─── Category normalization ───
const CATEGORY_MAP: Record<string, string> = {
  'oral care': 'Oral Care', 'mouthwash': 'Mouthwash', 'toothpaste': 'Toothpaste',
  'shampoo': 'Shampoo', 'conditioner': 'Conditioner', 'deodorant': 'Deodorant',
  'soap': 'Soap', 'body wash': 'Body Wash', 'skin care': 'Skin Care',
  'snacks': 'Snacks', 'chips': 'Chips', 'cookies': 'Cookies', 'crackers': 'Crackers',
  'candy': 'Candy', 'chocolate': 'Chocolate', 'gum': 'Gum',
  'cereal': 'Cereal', 'granola': 'Granola', 'oatmeal': 'Oatmeal',
  'pasta': 'Pasta', 'sauce': 'Sauces', 'condiment': 'Condiments',
  'frozen': 'Frozen Foods', 'ice cream': 'Ice Cream', 'pizza': 'Frozen Pizza',
  'beverages': 'Beverages', 'soda': 'Soft Drinks', 'juice': 'Juice', 'water': 'Water',
  'coffee': 'Coffee', 'tea': 'Tea', 'energy drink': 'Energy Drinks',
  'dairy': 'Dairy', 'milk': 'Milk', 'cheese': 'Cheese', 'yogurt': 'Yogurt',
  'bread': 'Bread & Bakery', 'cleaning': 'Cleaning Products', 'laundry': 'Laundry',
  'detergent': 'Detergent', 'dish': 'Dish Care', 'pet food': 'Pet Food',
  'baby': 'Baby Care', 'diaper': 'Diapers', 'paper towel': 'Paper Products',
  'toilet paper': 'Paper Products', 'tissue': 'Paper Products',
  'plant-based': 'Plant-Based Foods', 'meat': 'Meat & Poultry',
  'seafood': 'Seafood', 'produce': 'Fresh Produce',
  'cosmetic': 'Cosmetics', 'makeup': 'Makeup', 'personal care': 'Personal Care',
};

function normalizeCategory(raw: string | null): string | null {
  if (!raw || raw === 'undefined' || raw === 'null') return null;

  let cleaned = raw.trim();
  // Handle ">" paths — take most specific useful level
  if (cleaned.includes('>')) {
    const parts = cleaned.split('>').map(s => s.trim()).filter(Boolean);
    cleaned = parts[parts.length - 1];
    // If last segment is too generic, try second-to-last
    if (cleaned.length < 4 && parts.length > 1) cleaned = parts[parts.length - 2];
  }
  // Handle comma lists — take first meaningful
  if (cleaned.includes(',')) {
    cleaned = cleaned.split(',')[0].trim();
  }

  const lower = cleaned.toLowerCase();
  // Try exact map match
  for (const [key, label] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return label;
  }
  // Fallback: title case the cleaned string, max 35 chars
  cleaned = cleaned.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return cleaned.length > 35 ? cleaned.slice(0, 32) + '…' : cleaned;
}

// ─── Logo validation ───
const LOGO_PROVIDERS = ['logo.clearbit.com', 'upload.wikimedia.org', 'commons.wikimedia.org'];

function classifyLogo(url: string | null): { status: string; source: string | null } {
  if (!url) return { status: 'missing', source: null };
  try {
    const parsed = new URL(url);
    if (LOGO_PROVIDERS.some(p => parsed.hostname.includes(p))) {
      return { status: 'verified', source: parsed.hostname.split('.').slice(-2, -1)[0] };
    }
    if (parsed.pathname.endsWith('.ico')) return { status: 'favicon', source: 'favicon' };
    return { status: 'unverified', source: parsed.hostname };
  } catch {
    return { status: 'broken', source: null };
  }
}

// ─── Score state ───
function computeScoreState(scores: any): string {
  if (!scores) return 'unseen';
  const s = scores;
  const isBaseline = s.score === 50 && s.score_labor === 50 &&
    s.score_environment === 50 && s.score_politics === 50;
  if (isBaseline) return 'building';
  if (s.score != null) return 'scored';
  return 'building';
}

// ─── Profile completeness ───
function computeCompleteness(brand: any, scores: any, eventCount: number): number {
  let points = 0;
  const max = 8;
  if (brand.name) points++;
  if (brand.logo_url) points++;
  if (brand.website) points++;
  if (brand.parent_company) points++;
  if (scores && computeScoreState(scores) === 'scored') points++;
  if (eventCount > 0) points++;
  if (brand.category_slug) points++;
  if (brand.description) points++;
  return Math.round((points / max) * 100);
}

// ─── Profile status ───
function computeProfileStatus(completeness: number, scoreState: string, hasConflicts: boolean): string {
  if (hasConflicts) return 'needs_review';
  if (scoreState === 'scored' && completeness >= 60) return 'ready';
  if (completeness >= 30) return 'partial';
  return 'building';
}

// ─── Summary generation ───
function generateSummary(brand: any, scoreState: string, parentName: string | null, category: string | null): string {
  const name = brand.name || 'This brand';
  const parts: string[] = [];

  if (parentName) parts.push(`${name} is owned by ${parentName}.`);
  if (category) parts.push(`Found in: ${category}.`);
  if (brand.website) parts.push(`Website: ${brand.website}`);

  if (scoreState === 'scored') {
    parts.push('Accountability profile available.');
  } else if (scoreState === 'building') {
    parts.push('Profile is being built from public records and news sources.');
  } else {
    parts.push('This brand was recently added. We\'re gathering data.');
  }

  return parts.join(' ');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { brand_ids, limit = 100, offset = 0 } = await req.json().catch(() => ({}));

    // Fetch brands — either specific IDs or paginated batch
    let query = supabase
      .from('brands')
      .select('id, name, slug, logo_url, website, description, parent_company, category_slug, status')
      .order('created_at', { ascending: false });

    if (brand_ids?.length) {
      query = query.in('id', brand_ids);
    } else {
      query = query.range(offset, offset + limit - 1);
    }

    const { data: brands, error: brandErr } = await query;
    if (brandErr) throw brandErr;
    if (!brands?.length) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = brands.map(b => b.id);

    // Batch fetch scores and parent names
    const [scoresRes, parentsRes] = await Promise.all([
      supabase.from('brand_scores').select('brand_id, score, score_labor, score_environment, score_politics, score_social').in('brand_id', ids),
      supabase.from('brands').select('id, name').in('id', brands.filter(b => b.parent_company).map(b => b.parent_company!).filter(Boolean)),
    ]);

    const scoresMap = new Map((scoresRes.data || []).map(s => [s.brand_id, s]));
    const parentsMap = new Map((parentsRes.data || []).map(p => [p.id, p.name]));

    // Event counts — simple count query per brand batch
    const eventCountMap = new Map<string, number>();
    const { data: eventData } = await supabase
      .from('brand_events')
      .select('brand_id')
      .in('brand_id', ids)
      .eq('is_irrelevant', false)
      .limit(1000);
    if (eventData) {
      for (const e of eventData) {
        eventCountMap.set(e.brand_id, (eventCountMap.get(e.brand_id) || 0) + 1);
      }
    }

    // Build display profiles
    const profiles: any[] = [];
    const issues: any[] = [];

    for (const brand of brands) {
      const scores = scoresMap.get(brand.id);
      const parentName = brand.parent_company || null;
      const eventCount = eventCountMap.get(brand.id) || 0;
      const logoInfo = classifyLogo(brand.logo_url);
      const scoreState = computeScoreState(scores);
      const categoryLabel = normalizeCategory(brand.category_slug);
      const displayName = normalizeName(brand.name || '');
      const completeness = computeCompleteness(brand, scores, eventCount);
      const profileStatus = computeProfileStatus(completeness, scoreState, brand.status === 'needs_review');
      const summary = generateSummary(brand, scoreState, parentName ? normalizeName(parentName) : null, categoryLabel);

      profiles.push({
        brand_id: brand.id,
        display_name: displayName,
        normalized_name: displayName.toLowerCase(),
        logo_url: brand.logo_url,
        logo_source: logoInfo.source,
        logo_status: logoInfo.status,
        parent_display_name: parentName ? normalizeName(parentName) : null,
        category_label: categoryLabel,
        summary,
        score_state: scoreState,
        profile_status: profileStatus,
        profile_completeness: completeness,
        website: brand.website,
        last_enriched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Flag issues
      if (logoInfo.status === 'missing' || logoInfo.status === 'broken') {
        issues.push({ brand_id: brand.id, issue_type: 'missing_logo', severity: 'high', detected_value: brand.logo_url });
      }
      if (!brand.name || brand.name.length < 2) {
        issues.push({ brand_id: brand.id, issue_type: 'bad_name', severity: 'high', detected_value: brand.name });
      }
      if (!categoryLabel) {
        issues.push({ brand_id: brand.id, issue_type: 'missing_category', severity: 'medium', detected_value: brand.category_slug });
      }
      if (completeness < 30) {
        issues.push({ brand_id: brand.id, issue_type: 'low_completeness', severity: 'medium', detected_value: String(completeness) });
      }
    }

    // Upsert display profiles
    const { error: upsertErr } = await supabase
      .from('brand_display_profiles')
      .upsert(profiles, { onConflict: 'brand_id' });

    if (upsertErr) {
      console.error('Upsert error:', upsertErr);
      throw upsertErr;
    }

    // Insert issues (clear old unresolved first for these brands)
    if (issues.length > 0) {
      await supabase
        .from('brand_enrichment_issues')
        .delete()
        .in('brand_id', ids)
        .is('resolved_at', null);

      await supabase
        .from('brand_enrichment_issues')
        .insert(issues);
    }

    console.log(`[build-display-profiles] Processed ${profiles.length} brands, flagged ${issues.length} issues`);

    return new Response(
      JSON.stringify({
        processed: profiles.length,
        issues_flagged: issues.length,
        score_states: {
          scored: profiles.filter(p => p.score_state === 'scored').length,
          building: profiles.filter(p => p.score_state === 'building').length,
          unseen: profiles.filter(p => p.score_state === 'unseen').length,
        },
        profile_statuses: {
          ready: profiles.filter(p => p.profile_status === 'ready').length,
          partial: profiles.filter(p => p.profile_status === 'partial').length,
          building: profiles.filter(p => p.profile_status === 'building').length,
          needs_review: profiles.filter(p => p.profile_status === 'needs_review').length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[build-display-profiles] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
