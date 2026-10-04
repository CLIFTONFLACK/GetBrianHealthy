/**
 * Per-pick reference material behind /why-these-picks.
 *
 * The public page shows the brand's claims, Brian's read and the named
 * alternatives. The "say / don't say" guidance is for anyone writing ad or
 * social copy about these products, so it lives on the separate, noindexed
 * /why-these-picks/creator-notes page rather than in front of shoppers.
 *
 * Every pick is sold on Amazon. The brands' own sites could not be reached when
 * these were written (2026-10-01), so the brand claims below are the wording on
 * the Amazon listings themselves, and are named as such.
 */

export type BrandClaim = {
  claim: string;
  source: string;
};

export type ProductReference = {
  slug: string;
  /** Other real products considered and passed over in this category, for a named comparison. */
  alsoConsidered: string[];
  brandClaims: BrandClaim[];
  ourRead: string;
  say: string[];
  dontSay: string[];
  /** Replaces the brand claims and Brian's read for UK visitors, where the US wording would be an unauthorised claim. */
  gb?: { brandClaims: BrandClaim[]; ourRead: string };
  /** The "safe to say" lines for UK copy, when they differ from the US ones. */
  sayGb?: string[];
};

/** Great Britain authorises no L-theanine health claim, and the US relaxation wording is not allowed there. */
const UK_THEANINE_RULE =
  "In UK copy, any claim about relaxation, stress, mood, focus or sleep: no health claim is authorised for L-theanine in Great Britain. State the label only";

export const references: ProductReference[] = [
  {
    slug: "pure-encapsulations-magnesium-glycinate",
    alsoConsidered: [
      "Thorne Magnesium Glycinate (sold direct, not on Amazon in the UK)",
      "Micro Ingredients Magnesium Glycinate (higher dose, bulkier pack)",
      "Nature Made Magnesium Glycinate (familiar pharmacy brand, lower elemental dose)",
    ],
    brandClaims: [
      {
        claim: "120mg Bioavailable Magnesium Glycinate Chelate",
        source: "Title of the Amazon UK listing",
      },
      {
        claim: "A highly bioavailable magnesium chelate that is well tolerated and suitable for sensitive individuals",
        source: "Description on the Amazon UK listing",
      },
    ],
    ourRead:
      "The 120 mg figure is the label dose, and it sits well under the 350 mg a day supplemental upper limit, so it suits building up in steps. “Bioavailable” and “well tolerated” are the brand's own descriptions; glycinate is generally one of the gentler forms, but Brian has not seen a head-to-head trial that ranks the forms. We found no independent certification mark for this product, so we do not claim one.",
    say: [
      "Supports normal muscle and nerve function (robust evidence, NIH)",
      "Supports normal energy metabolism (robust evidence, NIH)",
    ],
    sayGb: [
      "Magnesium contributes to a reduction of tiredness and fatigue",
      "Magnesium contributes to normal muscle function",
      "Magnesium contributes to normal energy-yielding metabolism",
    ],
    dontSay: [
      "“Clinically proven to improve sleep”: the controlled trial found placebo worked just as well, and no sleep claim is authorised for magnesium in the UK",
      "Any claim that this product is NSF Certified for Sport or independently tested: we found no such mark",
      "“Better absorbed than other forms” as a fact, without naming it as the brand's own description",
    ],
  },
  {
    slug: "pure-encapsulations-creatine",
    alsoConsidered: [
      "Nutricost Performance Creatine Monohydrate (lower cost per gram)",
      "Optimum Nutrition Micronized Creatine Powder (familiar sports-nutrition brand)",
    ],
    brandClaims: [
      {
        claim: "Supports muscle strength, performance and recovery",
        source: "Title of the retailer listings for the 315 g tub",
      },
    ],
    ourRead:
      "The strength claim fits the research: meta-analyses in older adults found creatine alongside resistance training added strength. The 5 g serving is the studied dose. We found no independent testing mark for this one (such as NSF Certified for Sport), so it should not be pitched to athletes who need banned-substance testing.",
    say: [
      "Supports muscle strength when combined with resistance training (robust evidence)",
      "Supports lean muscle mass with regular training (promising evidence)",
    ],
    dontSay: [
      "“Proven brain benefits” or “improves focus”: cognitive research on creatine is early, not established",
      "“NSF Certified”, “clean” or “safe for athletes”: we found no testing mark for this product",
    ],
  },
  {
    slug: "thorne-creatine",
    alsoConsidered: [
      "Myprotein Creapure Creatine (Informed Sport, not NSF)",
      "Kinetica Creapure Creatine (Informed Sport, not NSF)",
    ],
    brandClaims: [
      {
        claim: "NSF Certified for Sport: every batch tested for label accuracy and for nearly 300 banned substances",
        source: "Brand's product page and the NSF certification program",
      },
    ],
    ourRead:
      "The NSF Certified for Sport mark is independently verifiable through NSF's own program, not just the brand's word, so we treat it as a fact rather than a marketing claim. This is the UK pick because the Pure Encapsulations creatine is not on Amazon UK. The UK claim wording is narrower than the US one: only the register's own sentence is allowed.",
    say: [
      "UK wording: creatine increases physical performance in successive bursts of short-term, high intensity exercise (adults doing high-intensity exercise, 3 g a day)",
      "NSF Certified for Sport, independently verifiable batch testing",
    ],
    dontSay: [
      "“Builds muscle”, “improves strength” or “proven brain benefits” in UK copy: only the authorised wording is allowed",
      "“Clean” or “safe for athletes” as a substitute for naming the actual NSF Certified for Sport mark",
    ],
  },
  {
    slug: "pure-encapsulations-l-theanine",
    alsoConsidered: [
      "Thorne Theanine (sold direct, not on Amazon in the UK)",
      "NOW Foods L-Theanine (cheapest per capsule, includes added inositol)",
      "Lamberts L-Theanine (UK practitioner brand)",
    ],
    brandClaims: [
      {
        claim: "200mg Clinically-Studied Suntheanine L-Theanine",
        source: "Title of the Amazon UK listing",
      },
      {
        claim: "Amino Acid Supplement to Support Relaxation, Stress and Nervous System",
        source: "Title of the Amazon US listing",
      },
    ],
    ourRead:
      "The independent research is a systematic review of 9 human randomized controlled trials on stress and anxiety, and a separate crossover trial measuring brain activity directly: real, but small and narrow. “Clinically studied” is true of the Suntheanine ingredient in general, not of this product. Both bottles name Suntheanine: the UK listing says so in its title, and the US bottle's own label reads “With Suntheanine®”. The US listing's relaxation and stress wording is not allowed in UK advertising.",
    gb: {
      brandClaims: [
        {
          claim: "200mg Clinically-Studied Suntheanine L-Theanine",
          source: "Title of the Amazon UK listing",
        },
      ],
      ourRead:
        "This page makes no health claim for L-theanine, because none is authorised for it in the UK. What it can say is what is on the label: 200 mg per capsule, in the branded Suntheanine form. “Clinically studied” is the brand's description of the ingredient in general, not of this product.",
    },
    say: [
      "May support relaxation and a calmer response to everyday stress (promising evidence, 9-RCT systematic review)",
      "May increase alpha brain-wave activity linked to relaxed wakefulness (early evidence)",
    ],
    sayGb: ["200 mg of L-theanine (as Suntheanine) per capsule, and nothing about what it does"],
    dontSay: [
      UK_THEANINE_RULE,
      "“Works like a sedative” or any sleep-specific claim: the evidence is for relaxed alertness, not sedation",
      "“Clinically studied” as a statement about this product rather than the ingredient",
    ],
  },
];
