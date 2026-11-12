/**
 * Geo reference data for the wrong-state / wrong-city filter.
 * Ambiguous 2-letter codes that collide with common English words or keyword tokens
 * (e.g. "in", "me", "or", "hi") are intentionally excluded from abbreviation matching.
 */

export const US_STATES: Record<string, string> = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california", CO: "colorado",
  CT: "connecticut", DE: "delaware", DC: "district of columbia", FL: "florida", GA: "georgia",
  HI: "hawaii", ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa", KS: "kansas", KY: "kentucky",
  LA: "louisiana", ME: "maine", MD: "maryland", MA: "massachusetts", MI: "michigan", MN: "minnesota",
  MS: "mississippi", MO: "missouri", MT: "montana", NE: "nebraska", NV: "nevada", NH: "new hampshire",
  NJ: "new jersey", NM: "new mexico", NY: "new york", NC: "north carolina", ND: "north dakota",
  OH: "ohio", OK: "oklahoma", OR: "oregon", PA: "pennsylvania", RI: "rhode island", SC: "south carolina",
  SD: "south dakota", TN: "tennessee", TX: "texas", UT: "utah", VT: "vermont", VA: "virginia",
  WA: "washington", WV: "west virginia", WI: "wisconsin", WY: "wyoming",
};

export const AMBIGUOUS_STATE_CODES = new Set([
  "al", "ar", "co", "de", "hi", "id", "in", "la", "ma", "me", "mo", "ms", "mt", "nd", "ne", "oh", "ok", "or", "pa",
]);

/** Major US cities (name → state code). Ambiguous common words (Mobile, Orange, Aurora, Jackson…) omitted. */
export const MAJOR_CITIES: Array<[string, string]> = [
  ["new york city", "NY"], ["nyc", "NY"], ["manhattan", "NY"], ["brooklyn", "NY"], ["los angeles", "CA"],
  ["chicago", "IL"], ["houston", "TX"], ["phoenix", "AZ"], ["philadelphia", "PA"], ["san antonio", "TX"],
  ["san diego", "CA"], ["dallas", "TX"], ["san jose", "CA"], ["austin", "TX"], ["jacksonville", "FL"],
  ["fort worth", "TX"], ["columbus", "OH"], ["charlotte", "NC"], ["san francisco", "CA"], ["indianapolis", "IN"],
  ["seattle", "WA"], ["denver", "CO"], ["nashville", "TN"], ["oklahoma city", "OK"], ["el paso", "TX"],
  ["boston", "MA"], ["portland", "OR"], ["las vegas", "NV"], ["detroit", "MI"], ["memphis", "TN"],
  ["louisville", "KY"], ["baltimore", "MD"], ["milwaukee", "WI"], ["albuquerque", "NM"], ["tucson", "AZ"],
  ["fresno", "CA"], ["sacramento", "CA"], ["kansas city", "MO"], ["mesa", "AZ"], ["atlanta", "GA"],
  ["omaha", "NE"], ["colorado springs", "CO"], ["raleigh", "NC"], ["long beach", "CA"], ["virginia beach", "VA"],
  ["miami", "FL"], ["oakland", "CA"], ["minneapolis", "MN"], ["tulsa", "OK"], ["tampa", "FL"],
  ["new orleans", "LA"], ["wichita", "KS"], ["cleveland", "OH"], ["bakersfield", "CA"], ["anaheim", "CA"],
  ["honolulu", "HI"], ["riverside", "CA"], ["lexington", "KY"], ["stockton", "CA"], ["corpus christi", "TX"],
  ["henderson", "NV"], ["st louis", "MO"], ["saint louis", "MO"], ["pittsburgh", "PA"], ["cincinnati", "OH"],
  ["anchorage", "AK"], ["greensboro", "NC"], ["plano", "TX"], ["newark", "NJ"], ["toledo", "OH"],
  ["orlando", "FL"], ["chula vista", "CA"], ["st petersburg", "FL"], ["saint petersburg", "FL"], ["durham", "NC"],
  ["fort wayne", "IN"], ["buffalo", "NY"], ["scottsdale", "AZ"], ["reno", "NV"], ["boise", "ID"],
  ["richmond", "VA"], ["spokane", "WA"], ["baton rouge", "LA"], ["des moines", "IA"], ["birmingham", "AL"],
  ["salt lake city", "UT"], ["tallahassee", "FL"], ["gainesville", "FL"], ["ocala", "FL"], ["fort lauderdale", "FL"],
  ["savannah", "GA"], ["charleston", "SC"], ["knoxville", "TN"], ["chattanooga", "TN"], ["asheville", "NC"],
  ["sarasota", "FL"], ["naples", "FL"], ["key west", "FL"], ["palm beach", "FL"], ["daytona beach", "FL"],
  ["st augustine", "FL"], ["miami beach", "FL"], ["clearwater", "FL"], ["pensacola", "FL"], ["destin", "FL"],
  ["san juan", "PR"], ["providence", "RI"], ["hartford", "CT"], ["albany", "NY"], ["rochester", "NY"],
  ["syracuse", "NY"], ["ann arbor", "MI"], ["grand rapids", "MI"], ["madison wi", "WI"], ["santa fe", "NM"],
  ["santa barbara", "CA"], ["palm springs", "CA"], ["napa", "CA"], ["sedona", "AZ"], ["aspen", "CO"],
  ["boulder", "CO"], ["park city", "UT"], ["washington dc", "DC"],
  ["florence", "AL"], ["fairhope", "AL"], ["boerne", "TX"], ["cary", "NC"], ["alexandria", "VA"],
  ["bloomington", "MN"], ["novi", "MI"], ["arlington", "TX"], ["tahoe", "CA"], ["sonoma", "CA"],
  ["monterey", "CA"], ["carmel", "CA"], ["irvine", "CA"], ["newport beach", "CA"], ["santa monica", "CA"],
  ["beverly hills", "CA"], ["pasadena", "CA"], ["waikiki", "HI"], ["maui", "HI"], ["kauai", "HI"],
  ["west palm beach", "FL"], ["boca raton", "FL"],
];

/**
 * Competitor hotel chains & common misspellings (trained on Razib Marketing / Cogwheel SEO rules).
 * Used to filter out non-Hilton competitor brand queries during ingest.
 */
export const COMPETITOR_CHAIN_BRANDS = [
  "marriott", "mariott", "marriot", "bonvoy", "ihg", "hyatt",
  "edition", "ritz carlton", "ritz-carlton", "luxury collection", "st regis", "st. regis",
  "w hotels", "w hotel", "sheraton", "delta hotels", "westin", "le meridien", "le méridien",
  "renaissance", "renassance", "renaisance", "autograph collection", "tribute portfolio",
  "gaylord", "courtyard", "four points", "springhill suites", "fairfield inn", "ac hotels",
  "ac hotel", "citizenm", "aloft", "moxy", "residence inn", "towneplace suites", "element",
  "six senses", "regent", "intercontinental", "kimpton", "hotel indigo", "crowne plaza",
  "even hotels", "voco", "holiday inn", "avid hotels", "staybridge suites", "candlewood suites",
  "park hyatt", "alila", "miraval", "andaz", "thompson", "dream hotels", "grand hyatt",
  "hyatt regency", "hyatt centric", "hyatt place", "hyatt house",
  "best western", "wyndham", "baymont", "days inn", "super 8", "la quinta", "ramada",
  "comfort inn", "comfort suites", "quality inn", "sleep inn", "clarion", "econo lodge",
  "rodeway inn", "cambria", "radisson", "country inn", "sonesta", "red roof", "motel 6",
  "drury", "omni", "loews", "four seasons", "fairmont", "sofitel", "novotel", "ibis",
  "mercure", "mandarin oriental", "peninsula", "rosewood", "langham", "hard rock",
  "margaritaville", "virgin hotels", "ace hotel", "1 hotel", "proper hotel", "pendry",
  "montage", "auberge", "oxford suites", "shilo inn",
] as const;

