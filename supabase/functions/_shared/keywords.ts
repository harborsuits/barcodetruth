export const CATEGORY_KEYWORDS: Record<string, { phrases: string[]; words: string[]; negatives?: string[] }> = {
  product_safety: {
    phrases: [
      "product recall", "voluntary recall", "mandatory recall", "safety notice", "class action over defects",
      "foodborne illness", "contamination", "undeclared allergen", "metal shards", "glass fragments", "listeria",
      "salmonella", "e. coli", "foreign material", "adulterated", "mislabeling", "misbranded",
      "undeclared ingredient", "not fit for consumption", "burn hazard", "electrocution risk", "fire hazard",
      "explosion risk", "asbestos", "lead paint", "pfas", "choking hazard", "safety violation", "unsafe product",
      "consumer warning", "safety alert", "product defect", "injury report", "death linked to", "hospitalized after",
      "fda warning", "cpsc recall", "do not use", "stop sale", "return immediately", "health hazard",
      "manufacturing defect", "design defect", "failure to warn", "product liability", "wrongful death suit"
    ],
    words: ["recall", "defective", "contaminated", "tainted", "unsafe", "injury", "choking", "allergen", "spoiled", "mold", "hazard", "defect", "cpsc", "fda", "warning", "alert", "poison", "toxic"]
  },
  labor: {
    phrases: [
      "unfair labor practice", "nlrb complaint", "union election", "union drive", "collective bargaining",
      "wage theft", "overtime violation", "forced overtime", "strike authorization", "labor dispute",
      "collective agreement", "union-busting", "overtime back pay", "minimum wage", "living wage", "fair wage",
      "unpaid overtime", "workers rights", "labor rights", "right to organize", "osha violation", "osha fine",
      "unsafe conditions", "workplace safety", "wrongful termination", "unfair labor", "class action lawsuit",
      "discrimination lawsuit", "hostile workplace", "labor law violation", "back pay", "wage violation",
      "workplace accident", "employee fatality", "injured worker", "safety citation", "workplace injury",
      "pay cut", "salary reduction", "unpaid wages", "wage claim", "stolen wages", "tip theft",
      "mass layoff", "job cuts", "workforce reduction", "hiring freeze", "downsizing announcement",
      "labor union", "union contract", "collective bargaining agreement", "labor agreement", "union vote",
      "worker exploitation", "sweatshop conditions", "child labor", "forced labor", "human trafficking",
      "employee walkout", "sick out", "work stoppage", "wildcat strike", "sympathy strike",
      "retaliation against", "whistleblower fired", "employee complaint", "eeoc complaint", "age discrimination",
      "gender discrimination", "racial discrimination", "disability discrimination", "pregnancy discrimination",
      "sexual harassment", "hostile work environment", "wrongful discharge", "constructive dismissal",
      "employee misclassification", "independent contractor", "gig worker rights", "benefits denied",
      "pension cuts", "401k match", "health insurance cuts", "parental leave", "maternity leave",
      "workers compensation", "injury claim", "death on the job", "occupational disease"
    ],
    words: [
      "union", "strike", "walkout", "picket", "lockout", "organizing", "grievance", "layoffs", "furloughs", "retaliation",
      "misclassification", "wages", "salary", "overtime", "benefits", "pension", "healthcare",
      "termination", "fired", "downsizing", "discrimination", "harassment", "whistleblower", "exploitation",
      "sweatshop", "osha", "nlrb", "dol", "maternity", "paternity", "vacation", "eeoc", "ada", "fmla",
      "severance", "redundancy", "outsourcing", "offshoring", "temp", "contractor", "gig", "uber", "lyft",
      "amazon", "warehouse", "fulfillment", "injury", "fatality", "accident", "safety", "hazard", "violation",
      "complaint", "grievance", "arbitration", "mediation", "negotiation", "contract", "agreement"
    ]
  },
  environment: {
    phrases: [
      "greenhouse gas", "scope 1", "scope 2", "scope 3", "toxic discharge", "chemical spill", "hazardous waste",
      "air quality violation", "water quality violation", "deforestation", "biodiversity loss", "emissions target",
      "consent order with epa", "superfund site", "violation of permit", "spill cleanup", "groundwater contamination",
      "climate change", "global warming", "carbon emissions", "co2 emissions", "carbon footprint", "net zero",
      "carbon neutral", "paris agreement", "climate target", "environmental violation", "environmental crime",
      "illegal dumping", "toxic waste", "oil spill", "epa fine", "clean air act", "clean water act", "consent decree",
      "water pollution", "air pollution", "soil contamination", "toxic release", "chemical leak",
      "climate pledge", "sustainability report", "carbon reduction", "net zero commitment", "science-based target",
      "environmental fine", "epa penalty", "clean water act violation", "clean air act violation",
      "plastic pollution", "ocean plastic", "microplastics", "single-use plastic", "packaging waste",
      "renewable energy", "solar power", "wind power", "green energy", "fossil fuel", "coal power",
      "fracking", "pipeline", "drilling", "offshore", "arctic", "amazon", "rainforest", "old growth",
      "endangered species", "habitat destruction", "wildlife", "conservation", "national park",
      "emissions scandal", "dieselgate", "greenwashing", "false claims", "misleading environmental",
      "carbon offset", "carbon credit", "emissions trading", "cap and trade", "carbon tax",
      "recycling program", "circular economy", "zero waste", "landfill", "incineration",
      "water usage", "water scarcity", "drought", "aquifer", "watershed", "river pollution",
      "methane emissions", "fugitive emissions", "flaring", "venting", "leak detection"
    ],
    words: [
      "emissions", "pollution", "spill", "waste", "toxic", "hazardous", "carbon", "methane", "sulfur", "nitrate",
      "climate", "environmental", "epa", "contamination", "greenhouse", "decarbonize", "sustainability", "renewable",
      "solar", "wind", "hydro", "nuclear", "fossil", "coal", "oil", "gas", "pipeline", "drilling",
      "deforestation", "biodiversity", "ecosystem", "habitat", "wildlife", "conservation", "endangered",
      "plastic", "recycling", "landfill", "incineration", "compost", "packaging", "waste",
      "water", "air", "soil", "groundwater", "aquifer", "watershed", "river", "ocean", "sea",
      "clean", "green", "sustainable", "eco", "organic", "natural", "certified", "offset"
    ]
  },
  policy: {
    phrases: [
      "legislation introduced", "new regulation", "regulatory proposal", "public comment period", "industry standard update",
      "introduced a bill", "signed into law", "final rule", "interim final rule", "executive order", "administration policy",
      "campaign rally", "political rally", "presidential visit", "governor visit", "election campaign", "town hall",
      "president trump", "president biden", "donald trump", "joe biden", "kamala harris", "mike pence", "barack obama",
      "white house", "capitol hill", "supreme court", "congress", "senate", "house of representatives",
      "republican party", "democratic party", "primary election", "general election", "midterm election",
      "campaign contribution", "political donation", "endorsement", "ballot measure", "referendum", "proposition",
      "lobbying disclosure", "political action committee", "super pac", "campaign finance", "dark money",
      "government investigation", "regulatory inquiry", "antitrust probe", "ftc investigation", "doj investigation",
      "policy change", "regulation", "legislative hearing", "congressional testimony", "subpoena",
      "government contract", "federal contract", "state contract", "procurement", "no-bid contract",
      "fec filing", "political spending", "corporate pac", "employee pac", "bundling", "fundraiser",
      "trade policy", "tariff", "import", "export", "trade war", "sanctions", "embargo",
      "tax policy", "tax credit", "tax incentive", "subsidy", "bailout", "stimulus",
      "regulatory capture", "revolving door", "lobbying", "lobbyist", "influence", "access"
    ],
    words: [
      "policy", "regulatory", "rulemaking", "ordinance", "ban", "moratorium", "compliance", "guidance", "legislation",
      "trump", "biden", "harris", "pence", "obama", "clinton", "desantis", "newsom", "president", "vice president",
      "potus", "senator", "congress", "congressman", "congresswoman", "representative", "governor", "mayor", "cabinet",
      "election", "electoral", "ballot", "vote", "voter", "voting", "primary", "caucus", "midterm", "campaign", "candidate",
      "rally", "debate", "convention", "nomination", "political", "politician", "democrat", "republican", "gop", "liberal",
      "conservative", "progressive", "partisan", "bipartisan", "lobbying", "lobbyist", "pac", "superpac", "donation",
      "fec", "ftc", "doj", "sec", "cfpb", "occ", "fed", "treasury", "commerce", "justice",
      "antitrust", "monopoly", "merger", "acquisition", "breakup", "divestiture", "consent"
    ]
  },
  legal: {
    phrases: [
      "settled for", "agreed to pay", "class action lawsuit", "antitrust suit", "consent decree", "injunction granted",
      "indictment filed", "criminal charges", "agreed settlement with", "class certified", "lawsuit alleges", "plea agreement",
      "securities fraud", "wire fraud", "mail fraud", "rico", "racketeering", "bribery", "corruption",
      "shareholder lawsuit", "derivative suit", "breach of fiduciary", "duty of care", "duty of loyalty",
      "patent infringement", "trademark infringement", "copyright infringement", "trade secret", "ip theft",
      "arbitration award", "jury verdict", "bench trial", "summary judgment", "motion to dismiss",
      "discovery dispute", "document production", "deposition", "interrogatories", "subpoena compliance"
    ],
    words: ["lawsuit", "litigation", "settlement", "fine", "penalty", "sanction", "subpoena", "indictment", "prosecution",
      "verdict", "judgment", "damages", "injunction", "restraining", "appeal", "plaintiff", "defendant",
      "attorney", "lawyer", "counsel", "court", "judge", "jury", "trial", "hearing", "motion",
      "fraud", "bribery", "corruption", "embezzlement", "theft", "crime", "criminal", "felony", "misdemeanor"]
  },
  financial: {
    phrases: ["earnings call", "profit warning", "guidance cut", "debt downgrade", "credit rating outlook", "share buyback",
      "revenue miss", "earnings miss", "profit miss", "guidance raised", "guidance lowered", "analyst upgrade", "analyst downgrade"],
    words: ["earnings", "revenue", "guidance", "downgrade", "buyback", "dividend", "loss", "profit", "margin", "quarterly", "annual", "forecast"]
  },
  social: {
    phrases: [
      "boycott campaign", "public backlash", "viral outrage", "brand controversy", "culture war", "misinformation campaign",
      "diversity initiative", "women in leadership", "female leaders", "gender equality", "dei program", "inclusion program",
      "racial justice", "lgbtq+ rights", "lgbtq rights", "social responsibility", "community impact", "women's empowerment",
      "minority representation", "equal opportunity", "pay equity", "workplace diversity", "inclusive culture",
      "black lives matter", "metoo", "me too", "civil rights", "affirmative action", "social justice",
      "discrimination lawsuit", "bias lawsuit", "racial discrimination", "gender discrimination", "sex discrimination",
      "community outreach", "charitable donation", "nonprofit partnership", "giving back", "corporate philanthropy",
      "consumer boycott", "social media campaign", "hashtag activism", "cancel culture", "deplatformed",
      "corporate responsibility", "esg", "stakeholder capitalism", "benefit corporation", "b corp",
      "community investment", "local hiring", "supplier diversity", "minority-owned", "women-owned",
      "accessibility", "ada compliance", "disability inclusion", "neurodiversity", "veteran hiring",
      "mental health", "employee wellness", "work-life balance", "remote work", "hybrid work"
    ],
    words: [
      "backlash", "boycott", "uproar", "viral", "culture", "social", "community", "pledge", "donation", "charity", "nonprofit",
      "diversity", "inclusion", "women", "female", "gender", "equality", "lgbtq", "lgbt", "transgender", "trans", "pronouns",
      "racial", "race", "racism", "racist", "minority", "representation", "equity", "dei", "empowerment", "inclusive",
      "underrepresented", "discrimination", "bias", "sexism", "homophobia", "transphobia", "injustice", "justice",
      "pride", "blm", "neighborhood", "philanthropy", "charitable", "foundation", "grant", "scholarship",
      "esg", "csr", "stakeholder", "sustainability", "ethical", "responsible", "impact", "purpose"
    ]
  },
  privacy_ai: {
    phrases: [
      "data breach", "ransomware attack", "customer data exposed", "privacy settlement", "ai transparency report",
      "dsar", "right to be forgotten", "consent violation", "ai hallucination risk", "model audit",
      "facial recognition", "biometric data", "location tracking", "behavioral tracking", "cross-device tracking",
      "data selling", "third-party sharing", "opt-out", "privacy policy", "terms of service",
      "gdpr fine", "ccpa violation", "hipaa breach", "ferpa violation", "coppa violation",
      "encryption", "security incident", "vulnerability", "zero-day", "patch", "update"
    ],
    words: ["privacy", "breach", "cyberattack", "hack", "gdpr", "ccpa", "algorithmic", "ai", "model", "training data",
      "data", "personal", "sensitive", "pii", "ssn", "credit card", "password", "credential", "leak", "exposed",
      "surveillance", "tracking", "cookies", "consent", "opt-in", "opt-out", "delete", "erasure"]
  },
  human_rights_supply: {
    phrases: [
      "forced labor", "child labor", "uyghur", "modern slavery", "supply chain audit", "responsible sourcing",
      "ilo complaint", "amfori bsci audit", "sa8000", "supplier code of conduct breach",
      "conflict minerals", "blood diamonds", "cobalt mining", "rare earth", "lithium extraction",
      "fair trade", "living wage", "worker rights", "factory conditions", "sweatshop",
      "human trafficking", "bonded labor", "debt bondage", "migrant workers", "visa abuse",
      "supply chain transparency", "supplier audit", "third-party audit", "corrective action", "remediation"
    ],
    words: ["forced", "child", "slavery", "human rights", "sourcing", "supply chain", "auditor", "factory",
      "labor", "exploitation", "trafficking", "migrant", "conflict", "mineral", "cobalt", "lithium",
      "transparency", "traceability", "audit", "certification", "compliance", "violation"]
  },
  antitrust_tax: {
    phrases: ["antitrust investigation", "market dominance case", "cartel probe", "transfer pricing", "tax avoidance scheme",
      "price fixing", "bid rigging", "market allocation", "monopolization", "abuse of dominance",
      "offshore tax", "tax haven", "shell company", "transfer pricing", "tax inversion",
      "eu competition", "ftc complaint", "doj antitrust", "state attorney general"],
    words: ["antitrust", "monopoly", "dominance", "cartel", "price fixing", "tax avoidance", "transfer pricing",
      "competition", "merger", "acquisition", "market", "share", "concentration", "barrier", "entry"]
  },
  noise: {
    phrases: [
      "analyst price target", "buy rating reiterated", "stock to watch", "reasons to buy",
      "upgrade", "downgrade", "price target raised", "price target lowered",
      "top stocks", "best stocks", "stocks to buy", "stocks to avoid", "market outlook",
      "portfolio update", "investment thesis", "bull case", "bear case", "valuation analysis"
    ],
    words: ["opinion", "editorial", "rumor", "speculation", "preview", "roundup", "investing tip",
      "analyst", "rating", "target", "buy", "sell", "hold", "outperform", "underperform"]
  }
};

// Global false-positive guards (sports "union", etc.)
export const NEGATIVE_GUARDS: string[] = [
  "sports union", "players union", "alumni union", "credit union",
  "strike zone", "bowling strike", "strike price", "lightning strike",
  "labor day sale", "labor day weekend", "labor of love",
  "green room", "green light", "green card", "green bay",
  "stock split", "stock photo", "stock image", "stock footage",
  "carbon copy", "carbon paper", "carbon fiber"
];
