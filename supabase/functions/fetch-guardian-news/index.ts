import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Keyword matching for categorization
const LABOR_KEYWORDS = [
  'layoff', 'layoffs', 'job cut', 'job cuts',
  'strike', 'union', 'unionize', 'labor dispute',
  'workers', 'employees', 'workplace safety',
  'injury', 'accident', 'osha', 'wage', 'overtime',
  'discrimination', 'harassment', 'fired', 'termination'
];

const ENVIRONMENT_KEYWORDS = [
  'pollution', 'contamination', 'toxic',
  'environmental', 'epa', 'emissions',
  'waste', 'dumping', 'spill', 'sustainability',
  'carbon', 'climate', 'deforestation',
  'water usage', 'packaging', 'recycling'
];

function matchesCategory(text: string, category: string): boolean {
  const keywords = category === 'labor' ? LABOR_KEYWORDS : ENVIRONMENT_KEYWORDS;
  const lowerText = text.toLowerCase();
  return keywords.some(kw => lowerText.includes(kw));
}

function calculateSeverity(text: string): string {
  const lowerText = text.toLowerCase();
  
  // High severity indicators
  if (lowerText.match(/lawsuit|sued|violation|illegal|criminal|death|catastrophic/)) {
    return 'severe';
  }
  
  // Medium severity
  if (lowerText.match(/fine|penalty|warning|investigation|complaint|alleged/)) {
    return 'moderate';
  }
  
  // Low severity
  return 'minor';
}

function generateStoryKey(title: string, date: string, brandId: string): string {
  // Normalize title (remove punctuation, lowercase, take first 50 chars)
  const normalized = title.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .substring(0, 50)
    .trim();
  
  // Combine with date and brand
  const dayBucket = date.substring(0, 10); // YYYY-MM-DD
  return `${brandId}:${dayBucket}:${normalized}`;
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

    const guardianKey = Deno.env.get("GUARDIAN_API_KEY");
    if (!guardianKey) {
      console.error("[Guardian] Missing GUARDIAN_API_KEY");
      return new Response(
        JSON.stringify({ error: "Guardian API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const brandId = url.searchParams.get("brand_id");
    const category = url.searchParams.get("category") || "labor"; // labor or environment
    const dryRun = url.searchParams.get("dryrun") === "1";

    if (!brandId) {
      return new Response(
        JSON.stringify({ error: "brand_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Guardian] Fetching ${category} news for brand_id: ${brandId}`);

    // Check feature flag
    const { data: config } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "ingest_news_enabled")
      .maybeSingle();

    if (config?.value === false) {
      console.log("[Guardian] News ingestion disabled via feature flag");
      return new Response(
        JSON.stringify({ 
          success: true, 
          scanned: 0, 
          inserted: 0, 
          skipped: 0, 
          note: "News ingestion disabled" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch brand details
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("id, name")
      .eq("id", brandId)
      .maybeSingle();

    if (brandError || !brand) {
      console.error("[Guardian] Brand not found:", brandError);
      return new Response(
        JSON.stringify({ error: "Brand not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Guardian API query with category-specific keywords
    const categoryKeywords = category === 'labor' 
      ? 'layoffs OR union OR strike OR workplace OR "job cuts"'
      : 'pollution OR environmental OR sustainability OR EPA OR emissions';
    
    const searchQuery = `${brand.name} AND (${categoryKeywords})`;
    
    // Date range: last 90 days
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const fromDate = since.toISOString().split('T')[0];

    const guardianUrl = new URL('https://content.guardianapis.com/search');
    guardianUrl.searchParams.set('q', searchQuery);
    guardianUrl.searchParams.set('from-date', fromDate);
    guardianUrl.searchParams.set('show-fields', 'headline,standfirst,bodyText');
    guardianUrl.searchParams.set('page-size', '50');
    guardianUrl.searchParams.set('api-key', guardianKey);

    console.log(`[Guardian] Query: ${searchQuery}`);

    const response = await fetch(guardianUrl.toString());
    
    if (!response.ok) {
      console.error(`[Guardian] API error: ${response.status}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          brand: brand.name, 
          scanned: 0, 
          inserted: 0, 
          skipped: 0,
          note: "Guardian API unavailable" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const articles = data?.response?.results || [];
    
    console.log(`[Guardian] Found ${articles.length} articles`);

    let scanned = 0;
    let inserted = 0;
    let skipped = 0;
    let corroborated = 0;

    for (const article of articles) {
      scanned++;

      const title = article.webTitle || article.fields?.headline || 'Untitled';
      const snippet = article.fields?.standfirst || article.fields?.bodyText?.substring(0, 300) || '';
      const articleUrl = article.webUrl;
      const publishedAt = article.webPublicationDate;

      // Verify article actually matches category keywords
      const fullText = `${title} ${snippet}`.toLowerCase();
      if (!matchesCategory(fullText, category)) {
        console.log(`[Guardian] Article doesn't match ${category} keywords: ${title}`);
        skipped++;
        continue;
      }

      console.log(`[Guardian] Processing article: ${title}`);

      // Calculate severity
      const severity = calculateSeverity(fullText);
      
      // Generate story key for deduplication
      const storyKey = generateStoryKey(title, publishedAt, brandId);

      // Check if this story already exists (for corroboration)
      const { data: existingEvents } = await supabase
        .from("brand_events")
        .select("event_id, verification, title")
        .eq("brand_id", brandId)
        .eq("category", category)
        .gte("occurred_at", new Date(Date.parse(publishedAt) - 86400000 * 2).toISOString()) // ±2 days
        .lte("occurred_at", new Date(Date.parse(publishedAt) + 86400000 * 2).toISOString());

      // Simple title similarity check
      let matchedEvent = null;
      if (existingEvents && existingEvents.length > 0) {
        for (const event of existingEvents) {
          const similarity = titleSimilarity(title, event.title);
          if (similarity > 0.6) { // 60% similar
            matchedEvent = event;
            break;
          }
        }
      }

      if (matchedEvent) {
        // Story already exists - add as corroborating source
        console.log(`[Guardian] Found matching event ${matchedEvent.event_id}, adding as source`);

        if (!dryRun) {
          // Check if we already have this exact URL as a source
          const { data: existingSource } = await supabase
            .from("event_sources")
            .select("id")
            .eq("event_id", matchedEvent.event_id)
            .eq("canonical_url", articleUrl)
            .maybeSingle();

          if (existingSource) {
            console.log(`[Guardian] Source already attached to event`);
            skipped++;
            continue;
          }

          // Add Guardian as another source
          const { error: sourceError } = await supabase
            .from("event_sources")
            .insert({
              event_id: matchedEvent.event_id,
              source_name: "The Guardian",
              title: title,
              source_url: articleUrl,
              canonical_url: articleUrl,
              domain_owner: "Guardian Media Group",
              registrable_domain: "theguardian.com",
              domain_kind: "media",
              source_date: publishedAt,
              is_primary: false,
              link_kind: "article",
              article_snippet: snippet.substring(0, 500)
            });

          if (sourceError) {
            console.error(`[Guardian] Failed to add source:`, sourceError);
            skipped++;
            continue;
          }

          // Count independent sources
          const { data: sources } = await supabase
            .from("event_sources")
            .select("registrable_domain")
            .eq("event_id", matchedEvent.event_id);

          const uniqueDomains = new Set(sources?.map(s => s.registrable_domain) || []);

          // Upgrade verification if we have 2+ independent sources
          if (uniqueDomains.size >= 2 && matchedEvent.verification === 'unverified') {
            await supabase
              .from("brand_events")
              .update({ verification: 'corroborated' })
              .eq("event_id", matchedEvent.event_id);
            
            console.log(`[Guardian] ✅ Upgraded event to 'corroborated' (${uniqueDomains.size} sources)`);
            corroborated++;
          }
        }

        inserted++;
        continue;
      }

      // New story - create event
      if (dryRun) {
        console.log(`[Guardian] [DRY-RUN] Would create new event: ${title}`);
        inserted++;
        continue;
      }

      const { data: newEvent, error: eventError } = await supabase
        .from("brand_events")
        .insert({
          brand_id: brandId,
          category: category,
          verification: "unverified",
          orientation: severity === 'severe' ? 'negative' : 'mixed',
          title: title,
          description: snippet.substring(0, 500),
          occurred_at: publishedAt,
          event_date: publishedAt,
          severity: severity,
          raw_data: {
            source: 'guardian',
            section: article.sectionName,
            story_key: storyKey
          }
        })
        .select("event_id")
        .single();

      if (eventError) {
        console.error(`[Guardian] Failed to insert event:`, eventError);
        skipped++;
        continue;
      }

      console.log(`[Guardian] Created event ${newEvent.event_id}`);

      // Insert source
      const { error: sourceError } = await supabase
        .from("event_sources")
        .insert({
          event_id: newEvent.event_id,
          source_name: "The Guardian",
          title: title,
          source_url: articleUrl,
          canonical_url: articleUrl,
          domain_owner: "Guardian Media Group",
          registrable_domain: "theguardian.com",
          domain_kind: "media",
          source_date: publishedAt,
          is_primary: false,
          link_kind: "article",
          article_snippet: snippet.substring(0, 500)
        });

      if (sourceError) {
        console.error(`[Guardian] Failed to insert source:`, sourceError);
      }

      console.log(`[Guardian] ✅ Created new ${category} event with Guardian source`);
      inserted++;
    }

    console.log(`[Guardian] Complete - Scanned: ${scanned}, Inserted: ${inserted}, Skipped: ${skipped}, Corroborated: ${corroborated}`);

    return new Response(
      JSON.stringify({
        success: true,
        brand: brand.name,
        category,
        scanned,
        inserted,
        skipped,
        corroborated,
        dry_run: dryRun
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Guardian] Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Simple title similarity (Jaccard index on words)
function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}
