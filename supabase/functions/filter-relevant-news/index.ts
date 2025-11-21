import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { brandId, articles } = await req.json();

    // Fetch brand context
    const { data: brand } = await supabase
      .from('brands')
      .select(`
        name,
        parent_company,
        wikidata_qid,
        companies!inner(
          name,
          country,
          ticker
        )
      `)
      .eq('id', brandId)
      .single();

    if (!brand) {
      return new Response(JSON.stringify({ filtered: articles }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Score each article for relevance
    const scoredArticles = articles.map((article: any) => {
      let score = 0;
      const text = (article.title + ' ' + article.description + ' ' + article.article_text).toLowerCase();

      // Check if article mentions parent company
      if (brand.parent_company && text.includes(brand.parent_company.toLowerCase())) {
        score += 0.3;
      }

      // Check if article mentions brand name
      if (text.includes(brand.name.toLowerCase())) {
        score += 0.4;
      }

      // Check if article mentions company country/location (handle companies being array or object)
      const company = Array.isArray(brand.companies) ? brand.companies[0] : brand.companies;
      if (company?.country && text.includes(company.country.toLowerCase())) {
        score += 0.2;
      }

      // Check if article mentions ticker
      if (company?.ticker && text.includes(company.ticker.toLowerCase())) {
        score += 0.3;
      }

      // Category filtering - penalize irrelevant categories
      const categoryHints = article.category_code || '';
      
      // For retail brands, penalize fashion/lifestyle content
      if (brand.name.toLowerCase().includes('boots') || brand.name.toLowerCase().includes('walgreens')) {
        if (categoryHints.includes('fashion') || text.includes('outfit') || text.includes('style tips')) {
          score -= 0.5;
        }
        // Boost pharmacy/healthcare mentions
        if (text.includes('pharmacy') || text.includes('healthcare') || text.includes('prescription')) {
          score += 0.3;
        }
      }

      // Domain authority check
      const domain = article.source_url ? new URL(article.source_url).hostname : '';
      const reputableDomains = ['reuters.com', 'apnews.com', 'bloomberg.com', 'wsj.com', 'ft.com', 'bbc.com'];
      if (reputableDomains.some(d => domain.includes(d))) {
        score += 0.2;
      }

      return {
        ...article,
        relevance_score: Math.max(0, Math.min(1, score))
      };
    });

    // Filter articles with relevance > 0.5
    const filtered = scoredArticles
      .filter((a: any) => a.relevance_score > 0.5)
      .sort((a: any, b: any) => b.relevance_score - a.relevance_score);

    return new Response(JSON.stringify({ filtered }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error filtering news:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
