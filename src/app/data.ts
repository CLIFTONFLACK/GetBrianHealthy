/**
 * Everything the /healthy section renders comes from this file. Adding or
 * swapping a product is a data change, not a code change.
 *
 * Honesty rules the data must keep (FTC endorsement guidance, FDA DSHEA):
 * - A figure we have not checked against the label or brand site is `null`,
 *   and the page says "being verified" rather than guessing.
 * - `verified` stays false until every label and price figure has a source.
 *   Unverified products render a draft banner.
 * - Evidence statements are structure/function only ("supports..."). Never
 *   treat, prevent, cure or reverse.
 */

import type { IconName } from "./icons";
import type { Region } from "./region";

export const PROGRAM_NAME = "Brian's Human Longevity Program";
export const PROGRAM_SHORT = "Human Longevity Program";
export const CONTACT_EMAIL = "healthy@getbrian.xyz";

/**
 * Master switch for search engines. While false, every /healthy page is
 * noindex and nothing under /healthy is listed in the sitemap, so draft
 * figures cannot be indexed. Flip to true only when all launch products are
 * `verified`.
 */
export const LAUNCHED = true;

export type EvidenceGrade = "strong" | "moderate" | "early";

export type Citation = { label: string; url: string };

export type EvidenceItem = {
  /** Structure/function wording only. */
  claim: string;
  grade: EvidenceGrade;
  summary: string;
  citations: Citation[];
};

export type Ingredient = {
  name: string;
  /** Amount per serving as printed on the label, or null until checked. */
  amount: string | null;
  /** Dose range used in the research, for side-by-side comparison. */
  studiedDose?: string;
};

export type Product = {
  slug: string;
  name: string;
  brand: string;
  category: "Creatine" | "Magnesium" | "L-theanine";
  format: string;
  /** Product packshot, or null until we have one checked against the brand's own listing. Path under /public. */
  image: string | null;
  imageAlt: string;
  /** Shown under the packshot when it differs from the pack linked (for example, a smaller bottle). */
  imageNote?: string;
  /** One line for cards. */
  summary: string;
  verdict: string;
  bestFor: string[];
  notFor: string[];
  servingSize: string | null;
  servingsPerContainer: number | null;
  ingredients: Ingredient[];
  priceUsd: number | null;
  priceCheckedAt: string | null;
  testing: string[];
  evidence: EvidenceItem[];
  safety: string[];
  pros: string[];
  cons: string[];
  /** One line for cards: what Brian's check of the research found in this pick's favour. Facts from `ingredients`/`testing` only. */
  advantage: string;
  /** Where the Buy button goes before an affiliate link is issued. */
  brandUrl: string;
  /** Set when a programme approves us. Takes precedence over brandUrl. */
  affiliateUrl: string | null;
  /**
   * Who the Buy button sends the reader to, when that is not the brand itself
   * (for example an iHerb affiliate link replacing brandUrl). Leave unset while
   * the button goes to the brand's own site.
   */
  retailer?: string;
  /**
   * Whether this programme's terms allow the affiliate link to sit behind our
   * own /go redirect. Some forbid it outright (iHerb's terms, Nov 2025:
   * "You may not use redirect links", with commission forfeited). Leave false
   * until the programme's written terms say otherwise.
   */
  redirectAllowed: boolean;
  lastReviewed: string | null;
  verified: boolean;
  /** Countries this pick is sold in. A product outside the visitor's region is never shown to them. */
  regions: Region[];
  /** The Amazon listing in each region. Each country's Amazon sells its own ASIN. */
  offers: Partial<Record<Region, { asin: string }>>;
  /** Fields that differ by region (pack size, claims), laid over the base fields by `resolveProduct`. */
  regional?: Partial<Record<Region, Partial<Product>>>;
};

/**
 * Amazon Associates store per region. The tag decides who is paid, so a link
 * built for one region must never carry the other's tag.
 */
export const AMAZON: Record<Region, { host: string; tag: string }> = {
  US: { host: "www.amazon.com", tag: "getbrian-20" },
  GB: { host: "www.amazon.co.uk", tag: "getbrian-21" },
};

/** Amazon requires this sentence, clearly and prominently, wherever we link to it. */
export const AMAZON_ASSOCIATE_STATEMENT = "As an Amazon Associate I earn from qualifying purchases.";

/** Direct Amazon link: no redirect, no shortener, so the destination is plain to the reader. */
export function amazonUrl(region: Region, asin: string): string {
  const { host, tag } = AMAZON[region];
  return `https://${host}/dp/${encodeURIComponent(asin)}?tag=${tag}`;
}

/** The hero headline. Structure/function wording, so it needs the FDA disclaimer on any page that shows it. */
export const TAGLINE = "Choose Longevity, Choose Brian.";

/** Intro copy for the homepage's "why three" band, sitting above the individual picks. */
export const TRIO_INTRO = {
  eyebrow: "Magnesium + L-theanine + Creatine",
  headline: "A purposeful trio for your healthy aging routine.",
  body: "Support your nutritional foundations. Make space to unwind. Get more from your strength training. Three complementary ingredients, each with a clear role.",
  /** Guards against the one overclaim this framing invites: that three together beat one alone. */
  disclaimer:
    "Each ingredient has research behind it on its own. Taking all three together hasn't been shown to work better than any one alone, or to extend lifespan.",
};

export type Goal = "energy" | "strength" | "focus" | "calm";

export type Supplement = {
  id: "magnesium" | "creatine" | "l-theanine";
  name: string;
  /** Short, benefit-led label for cards and tiles ("Cover the essentials"). */
  tagline: string;
  /** One-line takeaway for the trio section ("A thoughtful addition to your evening routine."). */
  value: string;
  role: string;
  /** What it contributes to healthy aging. Structure/function wording only. */
  contribution: string;
  /** Where the evidence is thinner than the role suggests. Shown beside the role, never hidden. */
  caveat?: string;
  /** Products in this category review this supplement. Null until a pick exists. */
  category: Product["category"] | null;
};

export const supplements: Supplement[] = [
  {
    id: "magnesium",
    name: "Magnesium",
    tagline: "Cover the essentials",
    value: "Essential nutritional support for an active life.",
    role: "Muscle function and energy",
    contribution:
      "Supports normal muscle contraction, nerve signaling and cellular energy production.",
    category: "Magnesium",
  },
  {
    id: "creatine",
    name: "Creatine",
    tagline: "Make your strength work count",
    value: "Extra support for the effort you put into getting stronger.",
    role: "Strength and physical performance.",
    contribution: "Supports strength and lean-mass gains alongside resistance training.",
    caveat:
      "Cognitive benefits are promising, but reliable improvements in everyday focus are not yet established.",
    category: "Creatine",
  },
  {
    id: "l-theanine",
    name: "L-theanine",
    tagline: "Support your wind-down",
    value: "A thoughtful addition to your evening routine.",
    role: "Calm and relaxation",
    contribution: "May support relaxation, managing everyday stress and winding down.",
    category: "L-theanine",
  },
];

/**
 * Engagement hooks for the goal chooser. Each one leads with the reader's
 * situation and ends in an honest answer, never a promise: no invented
 * numbers, no urgency, no "clinically proven".
 */
export type GoalAccent = "amber" | "primary" | "purple" | "cyan";

export const goals: {
  id: Goal;
  label: string;
  hook: string;
  supplement: Supplement["id"];
  /** Icon for the goal tile's chip (see icons.tsx). */
  icon: IconName;
  /**
   * Optional section id on the review page to land on, when the goal is a
   * secondary angle of that supplement (focus is creatine's caveated one).
   */
  section?: string;
  /**
   * Short caveat shown wherever this goal is named alongside its supplement's
   * main one (the picks rail), so a secondary angle never travels without it.
   */
  caveat?: string;
  /**
   * False keeps the goal off the homepage tiles while it still appears on its
   * review page and in the picks rail (Clifton, 2026-09-24: no Focus tile).
   */
  showTile?: boolean;
  /**
   * Short eyebrow for the goal tile ("Cellular Energy"), distinct from the
   * supplement's own tagline — needed because creatine covers two different
   * goals (strength, focus) and each tile's eyebrow should name *this*
   * angle, not repeat the supplement's blanket tagline on both tiles.
   */
  eyebrowDetail: string;
  accent: GoalAccent;
  image: string;
  imageAlt: string;
}[] = [
  {
    id: "energy",
    label: "Energy",
    hook: "Low on magnesium? Many don't get enough, and we need it to turn food into energy.",
    supplement: "magnesium",
    icon: "zap",
    eyebrowDetail: "Cellular Energy",
    accent: "amber",
    image: "/healthy/goals/energy.jpg",
    imageAlt: "A woman stretching outdoors at sunrise",
  },
  {
    id: "strength",
    label: "Strength",
    hook: "Lifting after 40? Meet one of the most-studied supplements for strength.",
    supplement: "creatine",
    icon: "dumbbell",
    eyebrowDetail: "Physical Power",
    accent: "primary",
    image: "/healthy/goals/strength.jpg",
    imageAlt: "A man mid-lift in a gym",
  },
  {
    id: "focus",
    label: "Focus",
    hook: "Creatine for your brain? Promising, not proven. Here is what the research really shows.",
    supplement: "creatine",
    icon: "target",
    section: "creatine",
    showTile: false,
    caveat: "promising, not proven",
    eyebrowDetail: "Cognition",
    accent: "purple",
    image: "/healthy/goals/focus.jpg",
    imageAlt: "A woman calmly focused at a desk",
  },
  {
    id: "calm",
    label: "Calm",
    hook: "Still wired at 10pm? Meet the compound from tea that people take to wind down.",
    supplement: "l-theanine",
    icon: "moon",
    eyebrowDetail: "Wind-Down",
    accent: "cyan",
    image: "/healthy/goals/calm.jpg",
    imageAlt: "A man reading by lamplight in the evening",
  },
];

/** The goals shown as homepage tiles, in order. */
export const tileGoals = goals.filter((g) => g.showTile !== false);

export function getSupplement(id: Supplement["id"]): Supplement {
  const s = supplements.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown supplement: ${id}`);
  return s;
}

/**
 * No health claim is authorised for L-theanine in Great Britain, so UK visitors
 * get neutral wording for it wherever the US copy says what it does.
 */
const GB_SUPPLEMENT_COPY: Partial<Record<Supplement["id"], Partial<Supplement>>> = {
  magnesium: {
    contribution:
      "Contributes to normal muscle function, normal functioning of the nervous system and normal energy-yielding metabolism, and to a reduction of tiredness and fatigue.",
  },
  // Great Britain authorises one creatine claim, so that sentence is the only thing said, and the focus caveat goes with the focus goal.
  creatine: {
    tagline: "For high-intensity exercise",
    value: "For adults who do short, intense bursts of exercise.",
    role: "Short bursts of high-intensity exercise",
    contribution:
      "Creatine increases physical performance in successive bursts of short-term, high intensity exercise. The claim applies to adults doing high-intensity exercise who take 3 g a day.",
    caveat: undefined,
  },
  "l-theanine": {
    tagline: "A tea amino acid",
    value: "An amino acid found naturally in tea.",
    role: "Evening routine",
    contribution:
      "L-theanine is an amino acid found naturally in tea. No health claim is authorised for it in the UK, so this site makes none.",
  },
};

const GB_GOAL_COPY: Partial<Record<Goal, Partial<(typeof goals)[number]>>> = {
  strength: {
    label: "Exercise",
    hook: "Do short, intense bursts of exercise? Meet creatine, the most-studied ingredient for them.",
    eyebrowDetail: "High-Intensity Exercise",
  },
  calm: {
    label: "Evening",
    hook: "Meet L-theanine, an amino acid found naturally in tea.",
    eyebrowDetail: "Evening Routine",
    // The moon would hint at the sleep and relaxation claim that is not allowed here.
    icon: "book",
  },
};

/** Goals that exist only for the US: the claim behind them is not authorised in Great Britain. */
const GB_HIDDEN_GOALS = new Set<Goal>(["focus"]);

/** The goals a supplement serves for a region's visitor, localized and with any not allowed there removed. */
export function goalsForSupplement(id: Supplement["id"], region: Region): (typeof goals)[number][] {
  return goals
    .filter((g) => g.supplement === id && !(region === "GB" && GB_HIDDEN_GOALS.has(g.id)))
    .map((g) => localizeGoal(g, region));
}

/** A supplement as a region's visitor should read it. */
export function localizeSupplement(s: Supplement, region: Region): Supplement {
  return region === "GB" ? { ...s, ...GB_SUPPLEMENT_COPY[s.id] } : s;
}

/** A goal as a region's visitor should read it. */
export function localizeGoal<G extends (typeof goals)[number]>(g: G, region: Region): G {
  return region === "GB" ? { ...g, ...GB_GOAL_COPY[g.id] } : g;
}

/** The supplement a product reviews, if any. */
export function supplementFor(p: Product): Supplement | undefined {
  return supplements.find((s) => s.category === p.category);
}

export const gradeLabels: Record<EvidenceGrade, { label: string; meaning: string }> = {
  strong: {
    label: "Robust evidence",
    meaning: "Consistent results across several randomized trials or meta-analyses.",
  },
  moderate: {
    label: "Promising evidence",
    meaning: "Supportive trials exist, but results vary or populations are narrow.",
  },
  early: {
    label: "Early evidence",
    meaning: "Small, short or mixed studies. Worth watching, not worth relying on.",
  },
};

const GRADE_RANK: Record<EvidenceGrade, number> = { strong: 2, moderate: 1, early: 0 };

/** The strongest grade among a product's evidence claims, for a single card-level badge. */
export function topGrade(p: Product): EvidenceGrade | null {
  if (p.evidence.length === 0) return null;
  return p.evidence.reduce<EvidenceGrade>(
    (best, ev) => (GRADE_RANK[ev.grade] > GRADE_RANK[best] ? ev.grade : best),
    p.evidence[0].grade,
  );
}

export type Faq = { question: string; answer: string };

/** Short, honest answers for the homepage FAQ. No hedging beyond what's true. */
export const faqs: Faq[] = [
  {
    // Same facts as the About page. Keep the two in step.
    question: "Who is Brian?",
    answer:
      "Brian is the voice of GetBrian. The research behind each review is gathered and summarized with the help of AI tools, then checked and signed off by Clifton Flack, who founded GetBrian. Brian is not a doctor.",
  },
  {
    question: "Is this medical advice?",
    answer:
      "No. It's general information, not a diagnosis or personal medical guidance. Talk to your doctor before starting a supplement, especially if you take medication or have a health condition.",
  },
  {
    question: "Do you earn money if I buy?",
    answer:
      "Yes. As an Amazon Associate I earn from qualifying purchases. The Buy buttons go to Amazon, and if you buy through them GetBrian is paid a commission at no extra cost to you. It never decides which products are listed or how they're graded.",
  },
  {
    question: "Why only one product per category?",
    answer:
      "One clear answer beats twenty options. Each pick is the one that best matched its studied dose, label and price once the research was checked; see why these picks for the comparison.",
  },
  {
    // Same reasons as the "Why these picks" page. Keep the two in step.
    question: "Why these brands?",
    answer:
      "Each pick is a single named ingredient at a fixed dose, so the label can be checked against what the research studied. The same brand is not sold in every country, so the picks you see depend on where you are. No brand can pay to be included, and a pick changes if a better-evidenced or better-priced option turns up in a re-check.",
  },
  {
    question: "Why do I see different products in the UK and the US?",
    answer:
      "Each country's Amazon sells different listings, and the rules on what a supplement may claim differ. The site shows the picks sold in your country, and you can switch country in the footer. Anywhere outside the UK sees the US picks.",
  },
  {
    question: "How often are picks re-checked?",
    answer:
      "At least every six months, or sooner if the price, label or evidence changes. A pick is dropped if it stops earning its place.",
  },
  {
    question: "Can I take all three together?",
    answer:
      "Each one does a different job, so most people only need the one that matches their goal. If you take more than one, check with your doctor first, especially alongside any medication.",
  },
];

export const pillars = [
  {
    title: "Research",
    description:
      "Reviews and trials first. Every claim gets a plain grade.",
  },
  {
    title: "Evaluation",
    description:
      "Label dose against studied dose, independent testing, cost per serving, safety.",
  },
  {
    title: "Selection",
    description:
      "Only passes make the list. Re-checked at least every six months.",
  },
];

/**
 * Evidence shared by the US pages. The UK variants below carry only the claims
 * Great Britain authorises, worded as the register words them.
 */
const NIH_MAGNESIUM: Citation = {
  label: "NIH Office of Dietary Supplements: Magnesium, health professional fact sheet",
  url: "https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/",
};

const GB_NHC_REGISTER: Citation = {
  label: "GB Nutrition and Health Claims Register (gov.uk)",
  url: "https://www.gov.uk/government/publications/great-britain-nutrition-and-health-claims-nhc-register",
};

const MAGNESIUM_EVIDENCE_US: EvidenceItem[] = [
  {
    claim: "Supports normal muscle and nerve function",
    grade: "strong",
    summary:
      "Magnesium is required for muscle contraction and nerve signaling, and most US adults do not meet the recommended daily intake from food alone.",
    citations: [NIH_MAGNESIUM],
  },
  {
    claim: "Supports normal energy metabolism",
    grade: "strong",
    summary: "Magnesium is a cofactor for the enzymes that convert food into usable cellular energy.",
    citations: [NIH_MAGNESIUM],
  },
  {
    claim: "May support sleep quality when magnesium intake is low",
    grade: "early",
    summary:
      "A 7-week randomized trial in adults over 50 with poor sleep found sleep scores improved on magnesium citrate, but improved by a similar amount on the placebo too, so the trial could not show magnesium caused the change.",
    citations: [
      {
        label: "Nielsen et al., 2011, Magnesium Research (randomized trial, 96 adults over 50)",
        url: "https://pubmed.ncbi.nlm.nih.gov/21199787/",
      },
    ],
  },
];

/** Authorised GB wording only. No sleep claim: none is authorised for magnesium. */
const MAGNESIUM_EVIDENCE_GB: EvidenceItem[] = [
  {
    claim: "Magnesium contributes to a reduction of tiredness and fatigue",
    grade: "strong",
    summary: "An authorised health claim for magnesium in Great Britain.",
    citations: [GB_NHC_REGISTER],
  },
  {
    claim: "Magnesium contributes to normal muscle function",
    grade: "strong",
    summary: "An authorised health claim for magnesium in Great Britain.",
    citations: [GB_NHC_REGISTER],
  },
  {
    claim: "Magnesium contributes to normal energy-yielding metabolism",
    grade: "strong",
    summary: "An authorised health claim for magnesium in Great Britain.",
    citations: [GB_NHC_REGISTER],
  },
];

const THEANINE_EVIDENCE_US: EvidenceItem[] = [
  {
    claim: "May support relaxation and a calmer response to everyday stress",
    grade: "moderate",
    summary:
      "A systematic review of 9 randomized controlled trials found that 200 to 400 mg per day of L-theanine may help lower stress and anxiety symptoms in people under stressful conditions, though the authors called for larger, longer trials before it is relied on as an established therapy.",
    citations: [
      {
        label: "Williams et al., 2020, Plant Foods for Human Nutrition (systematic review, 9 RCTs)",
        url: "https://pubmed.ncbi.nlm.nih.gov/31758301/",
      },
    ],
  },
  {
    claim: "May increase alpha brain-wave activity associated with relaxed wakefulness",
    grade: "early",
    summary:
      "A crossover trial measuring brain activity directly found greater resting alpha-wave activity 2 hours after an L-theanine drink than after placebo, but only in people who ran higher in trait anxiety to start with.",
    citations: [
      {
        label: "White et al., 2016, Nutrients (randomized crossover trial, MEG-measured brain activity)",
        url: "https://pubmed.ncbi.nlm.nih.gov/26797633/",
      },
    ],
  },
];

const CREATINE_EVIDENCE_US: EvidenceItem[] = [
  {
    claim: "Supports muscle strength when combined with resistance training",
    grade: "strong",
    summary:
      "In a meta-analysis of 22 randomized trials in adults with a mean age of 57 to 70, creatine taken alongside resistance training produced significantly greater gains in chest- and leg-press strength than training with a placebo.",
    citations: [
      {
        label: "Chilibeck et al., 2017, Open Access Journal of Sports Medicine (meta-analysis, 721 older adults)",
        url: "https://pubmed.ncbi.nlm.nih.gov/29138605/",
      },
    ],
  },
  {
    claim: "Supports lean muscle mass with regular training",
    grade: "moderate",
    summary:
      "Pooled results show a meaningful average gain in lean tissue mass in older adults, though the size of the effect varies by dosing strategy and study length.",
    citations: [
      {
        label: "Forbes et al., 2021, Nutrients (meta-analysis of creatine ingestion strategies in older adults)",
        url: "https://pubmed.ncbi.nlm.nih.gov/34199420/",
      },
    ],
  },
];

/** The authorised GB creatine claim, with its conditions. Check the register before relying on it: its creatine entry changed in 2025. */
const CREATINE_EVIDENCE_GB: EvidenceItem[] = [
  {
    claim: "Creatine increases physical performance in successive bursts of short-term, high intensity exercise",
    grade: "strong",
    summary:
      "The authorised GB claim. It applies to adults doing high-intensity exercise who take 3 g of creatine a day.",
    citations: [GB_NHC_REGISTER],
  },
];


/**
 * Where each pick is sold: Amazon, in the visitor's own country. Label figures
 * were read from retailer listings and the brand's marketing on 2026-10-01
 * (the brand's own site could not be reached), so the Pure Encapsulations
 * picks stay `verified: false` until checked against the bottle. No prices are
 * stored: Amazon's terms limit how long a price may be shown without a live feed.
 *
 * US and UK offers sell different ASINs, so each region has its own link.
 */
export const products: Product[] = [
  {
    slug: "pure-encapsulations-magnesium-glycinate",
    name: "Magnesium Glycinate",
    brand: "Pure Encapsulations",
    category: "Magnesium",
    format: "Capsules",
    image: "/healthy/products/pure-encapsulations-magnesium-glycinate.png",
    imageAlt: "Bottle of Pure Encapsulations magnesium glycinate capsules",
    imageNote: "The photo shows the 30-capsule bottle. The pack linked here is 90 capsules.",
    summary: "Single-ingredient magnesium glycinate, 120 mg a capsule, so you can build your dose up one capsule at a time.",
    verdict:
      "Magnesium glycinate at 120 mg per capsule with no blend, so the label can be checked against what the research studied. Costs more per milligram than a bulk powder.",
    bestFor: [
      "Adults who want to build their dose up one capsule at a time",
      "Anyone who gets loose stools from higher-dose magnesium forms",
    ],
    notFor: ["Buyers who want the lowest cost per milligram of elemental magnesium"],
    servingSize: "1 capsule",
    servingsPerContainer: 90,
    ingredients: [
      {
        name: "Magnesium (as magnesium glycinate)",
        amount: "120 mg",
        studiedDose: "Supplemental intake studied up to 350 mg/day, the US tolerable upper limit for supplemental elemental magnesium",
      },
    ],
    priceUsd: null,
    priceCheckedAt: null,
    testing: [
      "Brian found no independent certification mark (such as NSF Certified for Sport) for this product.",
      "The brand's own testing claims have not been checked against its site yet.",
    ],
    evidence: MAGNESIUM_EVIDENCE_US,
    safety: [
      "Do not take magnesium supplements if you have kidney disease unless your doctor advises it.",
      "Separate from some antibiotics and osteoporosis medicines by a few hours; ask your pharmacist.",
      "Higher doses of most magnesium forms can loosen stools; glycinate is one of the gentler forms.",
    ],
    pros: [
      "Single ingredient, easy to check against the label",
      "120 mg a capsule makes it easy to adjust your dose",
      "Same strength sold in both the US and the UK",
    ],
    cons: [
      "Higher cost per milligram of elemental magnesium than a bulk glycinate powder",
      "No independent certification mark found",
    ],
    advantage:
      "Dose checked against the research: 120 mg a capsule lets you build up in steps and stay under 350 mg a day, the US supplemental upper limit",
    brandUrl: "https://www.pureencapsulations.com/",
    affiliateUrl: null,
    retailer: "Amazon",
    redirectAllowed: false,
    lastReviewed: "October 1, 2026",
    verified: false,
    regions: ["US", "GB"],
    offers: { US: { asin: "B07P5K7DQP" }, GB: { asin: "B087B93NJB" } },
    regional: {
      GB: {
        // The UK bottle: a claim-free label, 90 capsules, and a two-capsule serving (45 servings).
        // The US bottle photo carries US health-claim wording, which cannot appear in UK advertising.
        image: "/healthy/products/pure-encapsulations-magnesium-glycinate-uk.png",
        imageNote: undefined,
        servingSize: "2 capsules",
        servingsPerContainer: 45,
        summary: "Single-ingredient magnesium glycinate, 120 mg a capsule.",
        advantage: "A single ingredient at 120 mg a capsule, so the label is easy to check and the dose easy to adjust",
        ingredients: [{ name: "Magnesium (as magnesium glycinate)", amount: "240 mg (120 mg per capsule)" }],
        evidence: MAGNESIUM_EVIDENCE_GB,
        safety: [
          "Do not take magnesium supplements if you have kidney disease unless your doctor advises it.",
          "Separate from some antibiotics and osteoporosis medicines by a few hours; ask your pharmacist.",
          "Do not exceed the recommended intake on the label. Food supplements should not replace a varied diet.",
        ],
      },
    },
  },
  {
    slug: "pure-encapsulations-creatine",
    name: "Creatine Monohydrate",
    brand: "Pure Encapsulations",
    category: "Creatine",
    format: "Powder",
    image: "/healthy/products/pure-encapsulations-creatine.png",
    imageAlt: "Tub of Pure Encapsulations creatine powder, 315 g",
    summary: "Plain creatine monohydrate powder, 5 g a serving, 60 servings a tub.",
    verdict:
      "5 g of plain creatine monohydrate per serving, the form and daily dose the research used. Brian found no independent testing mark for it, so athletes who need one should look elsewhere.",
    bestFor: ["Adults doing resistance training who want the studied form and dose"],
    notFor: ["Athletes who need NSF Certified for Sport testing"],
    servingSize: "1.5 teaspoons (5 g)",
    servingsPerContainer: 60,
    ingredients: [{ name: "Creatine monohydrate", amount: "5 g", studiedDose: "3 to 5 g per day" }],
    priceUsd: null,
    priceCheckedAt: null,
    testing: [
      "Brian found no independent certification mark (such as NSF Certified for Sport) for this product.",
      "The brand's own testing claims have not been checked against its site yet.",
    ],
    evidence: CREATINE_EVIDENCE_US,
    safety: [
      "Talk to your doctor first if you have kidney disease or take medication that affects the kidneys.",
      "Early water retention of a pound or two is common and is not fat gain.",
    ],
    pros: [
      "Plain creatine monohydrate, the form used in the research",
      "5 g a serving, the dose the research used",
    ],
    cons: [
      "No independent certification mark found",
      "Needs a spoon or scoop, unlike pre-measured packets",
    ],
    advantage: "Matched to the trials: 5 g of plain creatine monohydrate, the form and daily dose the research used",
    brandUrl: "https://www.pureencapsulations.com/",
    affiliateUrl: null,
    retailer: "Amazon",
    redirectAllowed: false,
    lastReviewed: "October 1, 2026",
    verified: false,
    regions: ["US"],
    offers: { US: { asin: "B0FSGYKS5Z" } },
  },
  {
    slug: "thorne-creatine",
    name: "Creatine Monohydrate",
    brand: "Thorne",
    category: "Creatine",
    format: "Powder",
    image: "/healthy/products/thorne-creatine.png",
    imageAlt: "Tub of Thorne creatine powder, 450 g",
    summary: "Micronised creatine monohydrate powder, 5 g a serving, 90 servings a tub, NSF Certified for Sport.",
    verdict:
      "5 g of plain creatine monohydrate per scoop, and NSF Certified for Sport, so every batch is checked for banned substances.",
    bestFor: [
      "Adults doing high-intensity or resistance training who want the studied form and dose",
      "Athletes who need NSF Certified for Sport testing",
    ],
    notFor: ["Buyers who want the lowest cost per gram"],
    servingSize: "1 scoop (5 g)",
    servingsPerContainer: 90,
    ingredients: [{ name: "Creatine monohydrate", amount: "5 g", studiedDose: "3 to 5 g per day" }],
    priceUsd: null,
    priceCheckedAt: null,
    testing: [
      "NSF Certified for Sport: the brand states every batch is tested for label accuracy and for nearly 300 substances banned by major athletic organizations.",
    ],
    evidence: CREATINE_EVIDENCE_GB,
    safety: [
      "Talk to your doctor first if you have kidney disease or take medication that affects the kidneys.",
      "Early water retention of a pound or two is common and is not fat gain.",
      "Do not exceed the recommended intake on the label. Food supplements should not replace a varied diet.",
    ],
    pros: [
      "NSF Certified for Sport, batch-tested for banned substances",
      "Plain creatine monohydrate, the form used in the research",
      "90 servings a tub",
    ],
    cons: ["Needs a scoop, unlike pre-measured packets"],
    advantage: "5 g of plain creatine monohydrate a serving, with NSF Certified for Sport batch testing",
    brandUrl: "https://www.thorne.com/products/dp/creatine",
    affiliateUrl: null,
    retailer: "Amazon",
    redirectAllowed: false,
    lastReviewed: "October 1, 2026",
    verified: false,
    regions: ["GB"],
    offers: { GB: { asin: "B07978VPPH" } },
  },
  {
    slug: "pure-encapsulations-l-theanine",
    name: "L-Theanine",
    brand: "Pure Encapsulations",
    category: "L-theanine",
    format: "Capsules",
    image: "/healthy/products/pure-encapsulations-l-theanine.png",
    imageAlt: "Bottle of Pure Encapsulations L-theanine capsules",
    summary: "200 mg of L-theanine a capsule, in the branded Suntheanine form, 60 capsules a bottle.",
    verdict:
      "200 mg of L-theanine per capsule, in the branded Suntheanine form, at a fixed dose. The label's serving is two capsules (400 mg), at the top of the 200 to 400 mg a day the research used. Costs more per capsule than generic L-theanine.",
    bestFor: ["Adults who want a single-ingredient L-theanine in the Suntheanine form"],
    notFor: ["Buyers who want the lowest cost per milligram (generic L-theanine capsules are cheaper)"],
    servingSize: "2 capsules",
    servingsPerContainer: 30,
    ingredients: [{ name: "L-theanine (as Suntheanine)", amount: "400 mg (200 mg per capsule)", studiedDose: "200 to 400 mg per day" }],
    priceUsd: null,
    priceCheckedAt: null,
    testing: [
      "Brian found no independent certification mark (such as NSF Certified for Sport) for this product.",
      "The brand's own testing claims have not been checked against its site yet.",
    ],
    evidence: THEANINE_EVIDENCE_US,
    safety: [
      "Generally well tolerated. Talk to your doctor before combining with blood pressure medication, since it may add to a blood-pressure-lowering effect.",
      "Interactions with sedatives have not been ruled out; check with a pharmacist if you take one.",
    ],
    pros: [
      "Suntheanine, a branded, purified form of L-theanine, named on the bottle's label",
      "Single ingredient, 200 mg a capsule",
    ],
    cons: [
      "Costs more per capsule than generic L-theanine",
      "The label's two-capsule serving is 400 mg, the top of the studied range",
    ],
    advantage: "Suntheanine, a single ingredient at 200 mg a capsule, within the studied 200 to 400 mg a day",
    brandUrl: "https://www.pureencapsulations.com/",
    affiliateUrl: null,
    retailer: "Amazon",
    redirectAllowed: false,
    lastReviewed: "October 1, 2026",
    verified: false,
    regions: ["US", "GB"],
    offers: { US: { asin: "B0016CXZJO" }, GB: { asin: "B07JZFQWTL" } },
    regional: {
      // No L-theanine health claim is authorised in Great Britain, so this version
      // states the label and nothing about what the ingredient does.
      GB: {
        // The UK bottle photo has a claim-free label. The US one carries US relaxation wording, which cannot appear in UK advertising.
        image: "/healthy/products/pure-encapsulations-l-theanine-uk.png",
        imageNote: undefined,
        servingSize: "1 capsule",
        summary: "200 mg of L-theanine (as Suntheanine) a capsule, 60 capsules a bottle.",
        verdict:
          "200 mg of L-theanine per capsule, in the branded Suntheanine form, at a fixed dose. This page makes no health claim for it: none is authorised in the UK.",
        bestFor: ["Adults who want a single-ingredient L-theanine at a fixed 200 mg dose"],
        servingsPerContainer: 60,
        ingredients: [{ name: "L-theanine (as Suntheanine)", amount: "200 mg" }],
        evidence: [],
        pros: ["Single ingredient, fixed 200 mg dose", "Suntheanine, a branded, purified form of L-theanine"],
        cons: ["Costs more per capsule than generic L-theanine"],
        advantage: "A single ingredient at a fixed 200 mg, in the branded Suntheanine form",
        safety: [
          "Talk to your doctor before taking it if you take blood pressure medication or sedatives.",
          "Do not exceed the recommended intake on the label. Food supplements should not replace a varied diet.",
        ],
      },
    },
  },
];


/** The base entry for a slug, before any region is applied. Use `getProductFor` to show a product. */
export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

/**
 * The product as one region's visitor sees it: regional overrides applied, the
 * Amazon link for that country set as the affiliate link, and no price (Amazon
 * limits how long a price may be shown, so the page sends readers to Amazon for it).
 * Null when the product is not sold in that region.
 */
export function resolveProduct(p: Product, region: Region): Product | null {
  const offer = p.offers?.[region];
  if (!p.regions?.includes(region) || !offer) return null;
  return {
    ...p,
    ...p.regional?.[region],
    priceUsd: null,
    priceCheckedAt: null,
    affiliateUrl: amazonUrl(region, offer.asin),
    retailer: "Amazon",
    redirectAllowed: false,
  };
}

/** Every pick sold in a region, resolved for it, in display order. */
export function productsFor(region: Region): Product[] {
  return products.flatMap((p) => resolveProduct(p, region) ?? []);
}

export function getProductFor(slug: string, region: Region): Product | undefined {
  const p = getProduct(slug);
  return p ? (resolveProduct(p, region) ?? undefined) : undefined;
}

/** The pick for a category in a region, so a visitor sent to the other region's product lands on theirs. */
export function pickFor(category: Product["category"], region: Region): Product | undefined {
  return productsFor(region).find((p) => p.category === category);
}

/** Price per serving in USD, or null if either figure is still unverified. */
export function costPerServing(p: Product): number | null {
  if (p.priceUsd === null || !p.servingsPerContainer) return null;
  return p.priceUsd / p.servingsPerContainer;
}

/**
 * Combined cost of one serving of every current pick, i.e. what a day costs
 * if you took all three. Null the moment any pick's cost per serving is
 * unverified, rather than silently summing over a gap.
 */
export function totalDailyCost(list: Product[] = products): number | null {
  let total = 0;
  for (const p of list) {
    const c = costPerServing(p);
    if (c === null) return null;
    total += c;
  }
  return total;
}

/** Where a shopper ends up: the affiliate link once approved, else the brand. */
export function outboundUrl(p: Product): string {
  return p.affiliateUrl ?? p.brandUrl;
}

/**
 * Whether the Buy button may go through /go. Before approval the
 * destination is a plain brand URL, so counting clicks breaks no programme's
 * rules. Once an affiliate link exists, only programmes that permit redirects
 * keep it; everything else links straight to the affiliate URL.
 */
export function usesRedirect(p: Product): boolean {
  // Amazon bars redirecting links, so anything sold there links straight out.
  if (p.offers && Object.keys(p.offers).length > 0) return false;
  return p.affiliateUrl === null || p.redirectAllowed;
}

/** The shop the Buy button leads to, named on the button: the brand unless `retailer` says otherwise. */
export function retailerName(p: Product): string {
  return p.retailer ?? p.brand;
}

/** The href the Buy button renders. */
export function buyHref(p: Product, from: string): string {
  return usesRedirect(p) ? `/go/${p.slug}?from=${from}` : outboundUrl(p);
}
