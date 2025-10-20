export type CategoryCode = 
  | 'FIN.EARNINGS' | 'FIN.ACQUISITION' | 'FIN.BANKRUPTCY'
  | 'PRODUCT.RECALL' | 'PRODUCT.LAUNCH'
  | 'LEGAL.LAWSUIT' | 'LEGAL.SETTLEMENT' | 'LEGAL.INVESTIGATION'
  | 'REGULATORY.VIOLATION' | 'REGULATORY.COMPLIANCE'
  | 'LABOR.SAFETY' | 'LABOR.WAGES' | 'LABOR.UNION' | 'LABOR.DISCRIMINATION'
  | 'ESG.ENVIRONMENT' | 'ESG.SOCIAL' | 'ESG.GOVERNANCE'
  | 'POLICY.POLITICAL' | 'POLICY.ADVOCACY'
  | 'SOCIAL.BOYCOTT' | 'SOCIAL.CAMPAIGN'
  | 'NOISE.GENERAL';

export type CategoryGroup = 
  | 'Financial'
  | 'Product Safety'
  | 'Legal'
  | 'Regulatory'
  | 'Labor'
  | 'ESG'
  | 'Policy'
  | 'Social & Cultural'
  | 'Noise';

export const categoryGroups: Record<CategoryGroup, {
  color: string;
  bgColor: string;
  codes: CategoryCode[];
}> = {
  'Financial': {
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    codes: ['FIN.EARNINGS', 'FIN.ACQUISITION', 'FIN.BANKRUPTCY']
  },
  'Product Safety': {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950',
    codes: ['PRODUCT.RECALL', 'PRODUCT.LAUNCH']
  },
  'Legal': {
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
    codes: ['LEGAL.LAWSUIT', 'LEGAL.SETTLEMENT', 'LEGAL.INVESTIGATION']
  },
  'Regulatory': {
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
    codes: ['REGULATORY.VIOLATION', 'REGULATORY.COMPLIANCE']
  },
  'Labor': {
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950',
    codes: ['LABOR.SAFETY', 'LABOR.WAGES', 'LABOR.UNION', 'LABOR.DISCRIMINATION']
  },
  'ESG': {
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950',
    codes: ['ESG.ENVIRONMENT', 'ESG.SOCIAL', 'ESG.GOVERNANCE']
  },
  'Policy': {
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950',
    codes: ['POLICY.POLITICAL', 'POLICY.ADVOCACY']
  },
  'Social & Cultural': {
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-50 dark:bg-pink-950',
    codes: ['SOCIAL.BOYCOTT', 'SOCIAL.CAMPAIGN']
  },
  'Noise': {
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    codes: ['NOISE.GENERAL']
  }
};

export function getCategoryGroup(categoryCode?: string | null): CategoryGroup {
  if (!categoryCode) return 'Noise';
  
  for (const [group, config] of Object.entries(categoryGroups)) {
    if (config.codes.includes(categoryCode as CategoryCode)) {
      return group as CategoryGroup;
    }
  }
  
  return 'Noise';
}

export function getCategoryDisplay(categoryCode?: string | null): {
  group: CategoryGroup;
  label: string;
  color: string;
  bgColor: string;
} {
  const group = getCategoryGroup(categoryCode);
  const config = categoryGroups[group];
  
  // Format the code for display (e.g., "LABOR.WAGES" -> "Wages")
  const label = categoryCode 
    ? categoryCode.split('.')[1]?.replace(/_/g, ' ') || categoryCode
    : 'General';
  
  return {
    group,
    label: label.charAt(0) + label.slice(1).toLowerCase(),
    color: config.color,
    bgColor: config.bgColor
  };
}
