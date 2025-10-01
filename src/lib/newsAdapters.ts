// Normalized news article interface
export interface NewsArticle {
  title: string;
  summary: string;
  url: string;
  published_at: string; // ISO timestamp
  source_name: string;
  category: "social" | "general";
  raw_data: Record<string, any>;
}

// Base adapter interface
export interface NewsSourceAdapter {
  name: string;
  fetch(query: string, brandName: string): Promise<NewsArticle[]>;
}

// Guardian Open Platform adapter
export class GuardianAdapter implements NewsSourceAdapter {
  name = "Guardian";
  private apiKey: string;
  private baseUrl = "https://content.guardianapis.com/search";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetch(query: string, brandName: string): Promise<NewsArticle[]> {
    const searchQuery = `${brandName} AND (${query})`;
    const url = new URL(this.baseUrl);
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("api-key", this.apiKey);
    url.searchParams.set("show-fields", "headline,trailText,bodyText,byline");
    url.searchParams.set("page-size", "10");
    url.searchParams.set("order-by", "newest");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Guardian API error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.response?.results || [];

    return results.map((article: any) => ({
      title: article.fields?.headline || article.webTitle,
      summary: article.fields?.trailText || article.fields?.bodyText?.slice(0, 300) || "",
      url: article.webUrl,
      published_at: article.webPublicationDate,
      source_name: "The Guardian",
      category: this.categorizeArticle(article),
      raw_data: article,
    }));
  }

  private categorizeArticle(article: any): "social" | "general" {
    const text = `${article.webTitle} ${article.fields?.trailText || ""}`.toLowerCase();
    const socialKeywords = ["lawsuit", "recall", "boycott", "protest", "scandal", "controversy", "discrimination"];
    return socialKeywords.some(kw => text.includes(kw)) ? "social" : "general";
  }
}

// NewsAPI adapter
export class NewsAPIAdapter implements NewsSourceAdapter {
  name = "NewsAPI";
  private apiKey: string;
  private baseUrl = "https://newsapi.org/v2/everything";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetch(query: string, brandName: string): Promise<NewsArticle[]> {
    const searchQuery = `${brandName} AND (${query})`;
    const url = new URL(this.baseUrl);
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("apiKey", this.apiKey);
    url.searchParams.set("sortBy", "publishedAt");
    url.searchParams.set("pageSize", "10");
    url.searchParams.set("language", "en");

    const response = await fetch(url.toString());
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("NewsAPI rate limit exceeded");
      }
      throw new Error(`NewsAPI error: ${response.status}`);
    }

    const data = await response.json();
    const articles = data.articles || [];

    return articles.map((article: any) => ({
      title: article.title,
      summary: article.description || article.content?.slice(0, 300) || "",
      url: article.url,
      published_at: article.publishedAt,
      source_name: article.source?.name || "NewsAPI",
      category: this.categorizeArticle(article),
      raw_data: article,
    }));
  }

  private categorizeArticle(article: any): "social" | "general" {
    const text = `${article.title} ${article.description || ""}`.toLowerCase();
    const socialKeywords = ["lawsuit", "recall", "boycott", "protest", "scandal", "controversy", "discrimination"];
    return socialKeywords.some(kw => text.includes(kw)) ? "social" : "general";
  }
}

// New York Times adapter
export class NYTimesAdapter implements NewsSourceAdapter {
  name = "NYTimes";
  private apiKey: string;
  private baseUrl = "https://api.nytimes.com/svc/search/v2/articlesearch.json";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetch(query: string, brandName: string): Promise<NewsArticle[]> {
    const searchQuery = `${brandName} AND (${query})`;
    const url = new URL(this.baseUrl);
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("api-key", this.apiKey);
    url.searchParams.set("sort", "newest");
    url.searchParams.set("fl", "headline,abstract,web_url,pub_date,source,lead_paragraph");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`NYTimes API error: ${response.status}`);
    }

    const data = await response.json();
    const docs = data.response?.docs || [];

    return docs.map((article: any) => ({
      title: article.headline?.main || "",
      summary: article.abstract || article.lead_paragraph?.slice(0, 300) || "",
      url: article.web_url,
      published_at: article.pub_date,
      source_name: "The New York Times",
      category: this.categorizeArticle(article),
      raw_data: article,
    }));
  }

  private categorizeArticle(article: any): "social" | "general" {
    const text = `${article.headline?.main || ""} ${article.abstract || ""}`.toLowerCase();
    const socialKeywords = ["lawsuit", "recall", "boycott", "protest", "scandal", "controversy", "discrimination"];
    return socialKeywords.some(kw => text.includes(kw)) ? "social" : "general";
  }
}

// GNews adapter
export class GNewsAdapter implements NewsSourceAdapter {
  name = "GNews";
  private apiKey: string;
  private baseUrl = "https://gnews.io/api/v4/search";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetch(query: string, brandName: string): Promise<NewsArticle[]> {
    const searchQuery = `${brandName} AND (${query})`;
    const url = new URL(this.baseUrl);
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("token", this.apiKey);
    url.searchParams.set("lang", "en");
    url.searchParams.set("max", "10");
    url.searchParams.set("sortby", "publishedAt");

    const response = await fetch(url.toString());
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("GNews rate limit exceeded");
      }
      throw new Error(`GNews API error: ${response.status}`);
    }

    const data = await response.json();
    const articles = data.articles || [];

    return articles.map((article: any) => ({
      title: article.title,
      summary: article.description || article.content?.slice(0, 300) || "",
      url: article.url,
      published_at: article.publishedAt,
      source_name: article.source?.name || "GNews",
      category: this.categorizeArticle(article),
      raw_data: article,
    }));
  }

  private categorizeArticle(article: any): "social" | "general" {
    const text = `${article.title} ${article.description || ""}`.toLowerCase();
    const socialKeywords = ["lawsuit", "recall", "boycott", "protest", "scandal", "controversy", "discrimination"];
    return socialKeywords.some(kw => text.includes(kw)) ? "social" : "general";
  }
}

// Factory to create adapters
export function createNewsAdapters(
  guardianKey?: string, 
  newsApiKey?: string, 
  nytKey?: string, 
  gnewsKey?: string
): NewsSourceAdapter[] {
  const adapters: NewsSourceAdapter[] = [];
  
  if (guardianKey) {
    adapters.push(new GuardianAdapter(guardianKey));
  }
  
  if (newsApiKey) {
    adapters.push(new NewsAPIAdapter(newsApiKey));
  }
  
  if (nytKey) {
    adapters.push(new NYTimesAdapter(nytKey));
  }
  
  if (gnewsKey) {
    adapters.push(new GNewsAdapter(gnewsKey));
  }
  
  return adapters;
}
