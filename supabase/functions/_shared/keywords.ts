export const CATEGORY_KEYWORDS: Record<string, { phrases: string[]; words: string[]; negatives?: string[] }> = {
  product_safety: {
    phrases: [
      "product recall","voluntary recall","mandatory recall","safety notice","class action over defects",
      "foodborne illness","contamination","undeclared allergen","metal shards","glass fragments","listeria",
      "salmonella","e. coli","foreign material","adulterated","mislabeling","misbranded",
      "undeclared ingredient","not fit for consumption","burn hazard","electrocution risk","fire hazard",
      "explosion risk","asbestos","lead paint","pfas","choking hazard","safety violation","unsafe product"
    ],
    words: ["recall","defective","contaminated","tainted","unsafe","injury","choking","allergen","spoiled","mold","hazard","defect"]
  },
  labor: {
    phrases: [
      "unfair labor practice","nlrb complaint","union election","union drive","collective bargaining",
      "wage theft","overtime violation","forced overtime","strike authorization","labor dispute",
      "collective agreement","union-busting","overtime back pay","minimum wage","living wage","fair wage",
      "unpaid overtime","workers rights","labor rights","right to organize","osha violation","osha fine",
      "unsafe conditions","workplace safety","wrongful termination","unfair labor","class action lawsuit",
      "discrimination lawsuit","hostile workplace","labor law violation","back pay","wage violation"
    ],
    words: [
      "union","strike","walkout","picket","lockout","organizing","grievance","layoffs","furloughs","retaliation",
      "misclassification","contractor status","wages","salary","overtime","benefits","pension","healthcare",
      "termination","fired","downsizing","discrimination","harassment","whistleblower","exploitation",
      "sweatshop","osha","nlrb","dol","maternity","paternity","vacation"
    ]
  },
  environment: {
    phrases: [
      "greenhouse gas","scope 1","scope 2","scope 3","toxic discharge","chemical spill","hazardous waste",
      "air quality violation","water quality violation","deforestation","biodiversity loss","emissions target",
      "consent order with epa","superfund site","violation of permit","spill cleanup","groundwater contamination",
      "climate change","global warming","carbon emissions","co2 emissions","carbon footprint","net zero",
      "carbon neutral","paris agreement","climate target","environmental violation","environmental crime",
      "illegal dumping","toxic waste","oil spill","epa fine","clean air act","clean water act","consent decree"
    ],
    words: [
      "emissions","pollution","spill","waste","toxic","hazardous","carbon","methane","sulfur","nitrate",
      "climate","environmental","epa","contamination","greenhouse","decarbonize","sustainability","renewable"
    ]
  },
  policy: {
    phrases: [
      "legislation introduced","new regulation","regulatory proposal","public comment period","industry standard update",
      "introduced a bill","signed into law","final rule","interim final rule","executive order","administration policy",
      "campaign rally","political rally","presidential visit","governor visit","election campaign","town hall",
      "president trump","president biden","donald trump","joe biden","kamala harris","mike pence","barack obama",
      "white house","capitol hill","supreme court","congress","senate","house of representatives",
      "republican party","democratic party","primary election","general election","midterm election",
      "campaign contribution","political donation","endorsement","ballot measure","referendum","proposition"
    ],
    words: [
      "policy","regulatory","rulemaking","ordinance","ban","moratorium","compliance","guidance","legislation",
      "trump","biden","harris","pence","obama","clinton","desantis","newsom","president","vice president",
      "potus","senator","congress","congressman","congresswoman","representative","governor","mayor","cabinet",
      "election","electoral","ballot","vote","voter","voting","primary","caucus","midterm","campaign","candidate",
      "rally","debate","convention","nomination","political","politician","democrat","republican","gop","liberal",
      "conservative","progressive","partisan","bipartisan","lobbying","lobbyist","pac"
    ]
  },
  legal: {
    phrases: [
      "settled for","agreed to pay","class action lawsuit","antitrust suit","consent decree","injunction granted",
      "indictment filed","criminal charges","agreed settlement with","class certified","lawsuit alleges","plea agreement"
    ],
    words: ["lawsuit","litigation","settlement","fine","penalty","sanction","subpoena","indictment","prosecution"]
  },
  financial: {
    phrases: ["earnings call","profit warning","guidance cut","debt downgrade","credit rating outlook","share buyback"],
    words: ["earnings","revenue","guidance","downgrade","buyback","dividend","loss","profit","margin"]
  },
  social: {
    phrases: [
      "boycott campaign","public backlash","viral outrage","brand controversy","culture war","misinformation campaign",
      "diversity initiative","women in leadership","female leaders","gender equality","dei program","inclusion program",
      "racial justice","lgbtq+ rights","lgbtq rights","social responsibility","community impact","women's empowerment",
      "minority representation","equal opportunity","pay equity","workplace diversity","inclusive culture",
      "black lives matter","metoo","me too","civil rights","affirmative action","social justice",
      "discrimination lawsuit","bias lawsuit","racial discrimination","gender discrimination","sex discrimination",
      "community outreach","charitable donation","nonprofit partnership","giving back","corporate philanthropy"
    ],
    words: [
      "backlash","boycott","uproar","viral","culture","social","community","pledge","donation","charity","nonprofit",
      "diversity","inclusion","women","female","gender","equality","lgbtq","lgbt","transgender","trans","pronouns",
      "racial","race","racism","racist","minority","representation","equity","dei","empowerment","inclusive",
      "underrepresented","discrimination","bias","sexism","homophobia","transphobia","injustice","justice",
      "pride","blm","neighborhood","philanthropy","charitable"
    ]
  },
  privacy_ai: {
    phrases: [
      "data breach","ransomware attack","customer data exposed","privacy settlement","ai transparency report",
      "dsar","right to be forgotten","consent violation","ai hallucination risk","model audit"
    ],
    words: ["privacy","breach","cyberattack","hack","gdpr","ccpa","algorithmic","ai","model","training data"]
  },
  human_rights_supply: {
    phrases: [
      "forced labor","child labor","uyghur","modern slavery","supply chain audit","responsible sourcing",
      "ilo complaint","amfori bsci audit","sa8000","supplier code of conduct breach"
    ],
    words: ["forced","child","slavery","human rights","sourcing","supply chain","auditor","factory"]
  },
  antitrust_tax: {
    phrases: ["antitrust investigation","market dominance case","cartel probe","transfer pricing","tax avoidance scheme"],
    words: ["antitrust","monopoly","dominance","cartel","price fixing","tax avoidance","transfer pricing"]
  },
  noise: {
    phrases: [
      "analyst price target","buy rating reiterated","stock to watch","reasons to buy",
      "upgrade","downgrade","price target raised","price target lowered"
    ],
    words: ["opinion","editorial","rumor","speculation","preview","roundup","investing tip"]
  }
};

// Global false-positive guards (sports "union", etc.)
export const NEGATIVE_GUARDS: string[] = [
  "sports union","players union","alumni union","credit union",
  "strike zone","bowling strike","strike price" // finance/sports contexts
];
