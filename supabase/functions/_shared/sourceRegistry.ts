// Auto-detect which news API keys are configured
// Returns list of source identifiers that should be used in ingestion

export type SourceId = 'guardian' | 'gdelt' | 'newsapi' | 'nyt' | 'gnews' | 'mediastack' | 'currents';

export interface SourceConfig {
  id: SourceId;
  name: string;
  dailyLimit: number;    // calls per 24h window
  requiresKey: boolean;
}

// Budget constraints for each source (free tier limits)
const SOURCE_CONFIGS: SourceConfig[] = [
  { id: 'guardian', name: 'Guardian', dailyLimit: 500, requiresKey: true },
  { id: 'gdelt', name: 'GDELT', dailyLimit: 5000, requiresKey: false },
  { id: 'newsapi', name: 'NewsAPI', dailyLimit: 100, requiresKey: true },
  { id: 'nyt', name: 'NYT', dailyLimit: 500, requiresKey: true },
  { id: 'gnews', name: 'GNews', dailyLimit: 100, requiresKey: true },
  { id: 'mediastack', name: 'Mediastack', dailyLimit: 16, requiresKey: true }, // ~500/month ÷ 30
  { id: 'currents', name: 'Currents', dailyLimit: 20, requiresKey: true },  // ~600/month ÷ 30
];

const ENV_KEY_MAP: Record<SourceId, string> = {
  'guardian': 'GUARDIAN_API_KEY',
  'gdelt': '',
  'newsapi': 'NEWSAPI_KEY',
  'nyt': 'NYT_API_KEY',
  'gnews': 'GNEWS_API_KEY',
  'mediastack': 'MEDIASTACK_API_KEY',
  'currents': 'CURRENTS_API_KEY',
};

export function getSourceConfig(id: SourceId): SourceConfig | undefined {
  return SOURCE_CONFIGS.find(s => s.id === id);
}

export function enabledSources(): SourceId[] {
  const enabled: SourceId[] = [];
  
  for (const config of SOURCE_CONFIGS) {
    if (!config.requiresKey) {
      enabled.push(config.id);
      continue;
    }
    
    const envKey = ENV_KEY_MAP[config.id];
    if (envKey && Deno.env.get(envKey)) {
      enabled.push(config.id);
    }
  }
  
  return enabled;
}

export function getApiKey(sourceId: SourceId): string | undefined {
  const envKey = ENV_KEY_MAP[sourceId];
  return envKey ? Deno.env.get(envKey) : undefined;
}
