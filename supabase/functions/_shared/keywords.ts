export const CATEGORY_KEYWORDS: Record<string, { phrases: string[]; words: string[]; negatives?: string[] }> = {
  product_safety: {
    phrases: [
      "product recall","voluntary recall","mandatory recall","safety notice","class action over defects",
      "foodborne illness","contamination","undeclared allergen","metal shards","glass fragments","listeria",
      "salmonella","e. coli","foreign material","adulterated","mislabeling","misbranded"
    ],
    words: ["recall","defective","contaminated","tainted","unsafe","injury","choking","allergen","spoiled","mold"]
  },
  labor: {
    phrases: [
      "unfair labor practice","nlrb complaint","union election","union drive","collective bargaining",
      "wage theft","overtime violation","forced overtime","strike authorization","labor dispute"
    ],
    words: ["union","strike","walkout","picket","lockout","organizing","grievance","layoffs","furloughs","retaliation"]
  },
  environment: {
    phrases: [
      "greenhouse gas","scope 1","scope 2","scope 3","toxic discharge","chemical spill","hazardous waste",
      "air quality violation","water quality violation","deforestation","biodiversity loss","emissions target"
    ],
    words: ["emissions","pollution","spill","waste","toxic","hazardous","carbon","methane","sulfur","nitrate"]
  },
  policy: {
    phrases: [
      "legislation introduced","new regulation","regulatory proposal","public comment period","industry standard update"
    ],
    words: ["policy","regulatory","rulemaking","ordinance","ban","moratorium","compliance","guidance"]
  },
  legal: {
    phrases: [
      "settled for","agreed to pay","class action lawsuit","antitrust suit","consent decree","injunction granted",
      "indictment filed","criminal charges"
    ],
    words: ["lawsuit","litigation","settlement","fine","penalty","sanction","subpoena","indictment","prosecution"]
  },
  financial: {
    phrases: ["earnings call","profit warning","guidance cut","debt downgrade","credit rating outlook","share buyback"],
    words: ["earnings","revenue","guidance","downgrade","buyback","dividend","loss","profit","margin"]
  },
  social: {
    phrases: [
      "boycott campaign","public backlash","viral outrage","brand controversy","culture war","misinformation campaign"
    ],
    words: ["backlash","boycott","uproar","viral","culture","social","community","pledge","donation"]
  },
  privacy_ai: {
    phrases: ["data breach","ransomware attack","customer data exposed","privacy settlement","ai transparency report"],
    words: ["privacy","breach","cyberattack","hack","gdpr","ccpa","algorithmic","ai","model","training data"]
  },
  human_rights_supply: {
    phrases: [
      "forced labor","child labor","uyghur","modern slavery","supply chain audit","responsible sourcing"
    ],
    words: ["forced","child","slavery","human rights","sourcing","supply chain","auditor","factory"]
  },
  antitrust_tax: {
    phrases: ["antitrust investigation","market dominance case","cartel probe","transfer pricing","tax avoidance scheme"],
    words: ["antitrust","monopoly","dominance","cartel","price fixing","tax avoidance","transfer pricing"]
  },
  noise: {
    phrases: ["analyst price target","buy rating reiterated","stock to watch","reasons to buy"],
    words: ["opinion","editorial","rumor","speculation","preview","roundup","investing tip"]
  }
};

// Global false-positive guards (sports "union", etc.)
export const NEGATIVE_GUARDS: string[] = [
  "sports union","players union","alumni union","credit union",
  "strike zone","bowling strike","strike price" // finance/sports contexts
];
