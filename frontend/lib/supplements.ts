/**
 * Supplement guide content. Doses and limits follow the NIH Office of Dietary Supplements
 * consumer fact sheets linked in each entry; reviewed 2026-11. General education only.
 */
import type { Profile } from '../sections/Home/types';

export type SupplementCategory = 'Performance' | 'Protein' | 'Vitamins & minerals' | 'Health & recovery';
export type Evidence = 'Strong' | 'Moderate' | 'Limited';
export type Certification = 'FDA PH registration' | 'USP Verified' | 'NSF Certified for Sport' | 'Informed Sport' | 'USDA Organic';

export type Supplement = {
  id: string;
  name: string;
  category: SupplementCategory;
  evidence: Evidence;
  /** Profile goals this supplement most often supports. */
  goals: string[];
  /** Not suggested for users under 18 without a doctor. */
  adultsOnly: boolean;
  /** Commonly needed from age 50 (absorption or needs change). */
  over50?: boolean;
  summary: string;
  benefits: string[];
  sideEffects: string[];
  dose: string;
  timing: string;
  cautions: string[];
  interactions: string[];
  certifications: Certification[];
  whereToBuy: string[];
  source: { label: string; url: string };
};

const NIH = (page: string, label: string) => ({ label: `NIH Office of Dietary Supplements: ${label}`, url: `https://ods.od.nih.gov/factsheets/${page}-Consumer/` });
const SPORT = NIH('ExerciseAndAthleticPerformance', 'Exercise and athletic performance');
const SPORT_SHOPS = ['Sports nutrition stores', 'Official brand stores on LazMall or Shopee Mall', 'iHerb (ships internationally)'];
const PHARMACY = ['Licensed pharmacies such as Mercury Drug, Watsons, Southstar Drug or Rose Pharmacy', 'Official brand stores on LazMall or Shopee Mall', 'iHerb (ships internationally)'];
const SPORT_MARKS: Certification[] = ['FDA PH registration', 'NSF Certified for Sport', 'Informed Sport'];
const VITAMIN_MARKS: Certification[] = ['FDA PH registration', 'USP Verified', 'NSF Certified for Sport'];

export const SUPPLEMENTS: Supplement[] = [
  {
    id: 'creatine', name: 'Creatine monohydrate', category: 'Performance', evidence: 'Strong', goals: ['Build muscle', 'Strength'], adultsOnly: true,
    summary: 'The most researched strength supplement. Helps muscles recycle energy during short, hard efforts.',
    benefits: ['More strength and power in sets of heavy lifting or sprints', 'Greater gains in lean mass alongside resistance training', 'Faster recovery between high-intensity sets'],
    sideEffects: ['Water weight gain of about 1–2 kg in the first weeks (water stored in muscle, not fat)', 'Stomach upset or cramping if large doses are taken at once'],
    dose: '3–5 g a day. An optional loading phase is 20 g a day split into 4 doses for 5–7 days, then 3–5 g a day.',
    timing: 'Any time of day, every day, including rest days. Take with water or a meal.',
    cautions: ['Kidney disease or reduced kidney function: ask your doctor first', 'Not suggested for teenagers without medical advice', 'Choose plain creatine monohydrate; blends add cost without proven benefit'],
    interactions: ['Medicines that strain the kidneys (for example high-dose NSAIDs): ask your doctor'],
    certifications: SPORT_MARKS, whereToBuy: SPORT_SHOPS, source: SPORT,
  },
  {
    id: 'whey', name: 'Whey protein', category: 'Protein', evidence: 'Strong', goals: ['Build muscle', 'Strength', 'Weight loss'], adultsOnly: false,
    summary: 'A fast-digesting, complete milk protein that makes it easier to reach a daily protein target.',
    benefits: ['Supports muscle repair and growth after training', 'Rich in leucine, the amino acid that switches on muscle building', 'Helps keep you full while losing weight', 'Convenient when meals fall short on protein'],
    sideEffects: ['Bloating or gas, mostly in people sensitive to lactose (isolate has less lactose)', 'Acne flare-ups in some people'],
    dose: '20–40 g per serving, as needed to reach about 1.2–2.0 g of protein per kg of body weight a day from all foods.',
    timing: 'Within a couple of hours after training, or as part of a meal or snack that is low in protein.',
    cautions: ['Milk allergy: avoid; choose a plant protein instead', 'Kidney disease: ask your doctor about your protein limit', 'Not needed if your meals already meet your protein target'],
    interactions: ['Some antibiotics (tetracyclines, quinolones) and levodopa: take 2 hours apart'],
    certifications: SPORT_MARKS, whereToBuy: SPORT_SHOPS, source: SPORT,
  },
  {
    id: 'plant-protein', name: 'Plant protein (soy or pea)', category: 'Protein', evidence: 'Moderate', goals: ['Build muscle', 'Weight loss', 'General fitness'], adultsOnly: false,
    summary: 'A dairy-free protein for vegans or anyone who cannot have milk.',
    benefits: ['Supports muscle repair when daily protein is low', 'Soy is a complete protein; pea works best blended with rice protein', 'Usually free of lactose'],
    sideEffects: ['Bloating or gas', 'Some products contain heavy metals; third-party testing matters more here'],
    dose: '25–40 g per serving (plant proteins need slightly more per serving than whey).',
    timing: 'After training or with a meal that is low in protein.',
    cautions: ['Soy or pea allergy: avoid', 'Pick tested products to limit heavy-metal exposure'],
    interactions: ['Soy may reduce absorption of levothyroxine: take 4 hours apart'],
    certifications: ['FDA PH registration', 'NSF Certified for Sport', 'Informed Sport', 'USDA Organic'], whereToBuy: SPORT_SHOPS, source: SPORT,
  },
  {
    id: 'caffeine', name: 'Caffeine', category: 'Performance', evidence: 'Strong', goals: ['Endurance', 'Strength', 'General fitness'], adultsOnly: true,
    summary: 'A stimulant that improves endurance, strength and focus during training.',
    benefits: ['Longer endurance and more reps before fatigue', 'Sharper focus and reaction time', 'Workouts feel easier'],
    sideEffects: ['Jitters, anxiety and a racing heart', 'Poor sleep if taken within about 6 hours of bedtime', 'Stomach upset', 'Raised blood pressure for a few hours'],
    dose: '3–6 mg per kg of body weight about 60 minutes before exercise. Healthy adults should stay under 400 mg a day from all sources, including coffee and pre-workouts.',
    timing: 'About 30–60 minutes before training; avoid late-day doses.',
    cautions: ['Not for anyone under 18', 'Pregnancy: keep under 200 mg a day and ask your doctor', 'Heart rhythm problems, high blood pressure or anxiety disorders: ask your doctor', 'Never use pure caffeine powder: a single teaspoon can be a toxic dose'],
    interactions: ['Stimulant medicines, some antibiotics and theophylline increase its effects', 'Do not combine with other pre-workout products'],
    certifications: SPORT_MARKS, whereToBuy: SPORT_SHOPS,
    source: { label: 'U.S. FDA: How much caffeine is too much?', url: 'https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much' },
  },
  {
    id: 'beta-alanine', name: 'Beta-alanine', category: 'Performance', evidence: 'Moderate', goals: ['Endurance', 'Strength'], adultsOnly: true,
    summary: 'Raises muscle carnosine, which buffers acid during hard efforts lasting 1 to 4 minutes.',
    benefits: ['More reps in high-rep sets and circuits', 'Better performance in hard 1–4 minute efforts such as intervals'],
    sideEffects: ['Harmless tingling or prickling of the skin (paresthesia) for up to an hour; smaller split doses reduce it'],
    dose: '3.2–6.4 g a day, split into doses of 0.8–1.6 g, for at least 4 weeks.',
    timing: 'With meals, spread through the day. Benefit builds over weeks, so timing around training matters little.',
    cautions: ['Not suggested for teenagers', 'Limited long-term safety data beyond a few months'],
    interactions: ['No well-known interactions; ask your pharmacist if you take regular medicine'],
    certifications: SPORT_MARKS, whereToBuy: SPORT_SHOPS, source: SPORT,
  },
  {
    id: 'electrolytes', name: 'Electrolytes (sodium and potassium)', category: 'Performance', evidence: 'Moderate', goals: ['Endurance', 'Weight loss', 'General fitness'], adultsOnly: false,
    summary: 'Replaces the salt you sweat out during long or hot workouts.',
    benefits: ['Helps you stay hydrated in long or sweaty sessions', 'May reduce cramps linked to heavy salt loss', 'Helps the body hold on to the water you drink'],
    sideEffects: ['Too much sodium can raise blood pressure', 'Bloating or stomach upset if taken in strong doses'],
    dose: 'About 300–600 mg of sodium per hour of exercise lasting over 60–90 minutes or with heavy sweating. Plain water is enough for shorter sessions.',
    timing: 'During and after long or hot workouts.',
    cautions: ['High blood pressure, heart failure or kidney disease: ask your doctor before adding sodium or potassium', 'Many sports drinks add a lot of sugar; check the label'],
    interactions: ['Potassium with ACE inhibitors, ARBs or potassium-sparing diuretics can raise blood potassium to dangerous levels'],
    certifications: SPORT_MARKS, whereToBuy: SPORT_SHOPS, source: NIH('Potassium', 'Potassium'),
  },
  {
    id: 'vitamin-d', name: 'Vitamin D3', category: 'Vitamins & minerals', evidence: 'Strong', goals: ['General fitness', 'Strength'], adultsOnly: false, over50: true,
    summary: 'Needed to absorb calcium and keep bones and muscles working; many indoor workers run low.',
    benefits: ['Keeps bones strong together with calcium', 'Supports normal muscle function', 'Corrects low levels in people with little sun exposure'],
    sideEffects: ['Too much over time raises blood calcium, causing nausea, weakness, confusion and kidney stones'],
    dose: '600 IU (15 mcg) a day for ages 1–70 and 800 IU (20 mcg) over 70. Do not exceed 4,000 IU (100 mcg) a day unless a doctor prescribes it after a blood test.',
    timing: 'With a meal that contains some fat, for better absorption.',
    cautions: ['Kidney disease or high blood calcium: ask your doctor', 'A blood test shows whether you actually need more'],
    interactions: ['Steroids (prednisone), orlistat and some cholesterol and seizure medicines lower vitamin D', 'Thiazide diuretics with vitamin D can raise blood calcium'],
    certifications: VITAMIN_MARKS, whereToBuy: PHARMACY, source: NIH('VitaminD', 'Vitamin D'),
  },
  {
    id: 'omega-3', name: 'Omega-3 fish oil (EPA and DHA)', category: 'Health & recovery', evidence: 'Moderate', goals: ['General fitness', 'Endurance', 'Weight loss'], adultsOnly: false,
    summary: 'Healthy fats from fish that support the heart, especially if you rarely eat fatty fish.',
    benefits: ['Lowers high triglycerides', 'Supports heart health', 'May ease joint stiffness'],
    sideEffects: ['Fishy aftertaste or burps', 'Heartburn, nausea or loose stools', 'High doses may raise the risk of irregular heartbeat in people with heart disease'],
    dose: 'About 250–500 mg of combined EPA and DHA a day for general health, or eat fatty fish twice a week. Stay under 5 g a day from supplements unless a doctor advises more.',
    timing: 'With a meal to reduce aftertaste and improve absorption.',
    cautions: ['Fish or shellfish allergy: ask your doctor', 'Surgery planned: tell your doctor you take it'],
    interactions: ['Blood thinners such as warfarin: may increase bleeding risk'],
    certifications: VITAMIN_MARKS, whereToBuy: PHARMACY, source: NIH('Omega3FattyAcids', 'Omega-3 fatty acids'),
  },
  {
    id: 'magnesium', name: 'Magnesium (glycinate or citrate)', category: 'Vitamins & minerals', evidence: 'Moderate', goals: ['General fitness', 'Endurance', 'Strength'], adultsOnly: false,
    summary: 'A mineral used in muscle contraction, nerve signalling and energy production; diets are often low in it.',
    benefits: ['Supports normal muscle and nerve function', 'Helps turn food into energy', 'Corrects a low intake that can cause cramps or fatigue'],
    sideEffects: ['Diarrhea and stomach cramps, especially with magnesium oxide or citrate', 'Very high doses can cause dangerous low blood pressure and irregular heartbeat'],
    dose: 'Daily needs are 400–420 mg for men and 310–320 mg for women from all sources. Keep supplements under 350 mg a day unless a doctor advises more.',
    timing: 'With food; in the evening if it makes you drowsy.',
    cautions: ['Kidney disease: avoid unless your doctor prescribes it'],
    interactions: ['Take 2 hours apart from tetracycline or quinolone antibiotics, and 2 hours apart from bisphosphonates (osteoporosis medicine)', 'Some diuretics change magnesium levels'],
    certifications: VITAMIN_MARKS, whereToBuy: PHARMACY, source: NIH('Magnesium', 'Magnesium'),
  },
  {
    id: 'calcium', name: 'Calcium', category: 'Vitamins & minerals', evidence: 'Strong', goals: ['General fitness'], adultsOnly: false, over50: true,
    summary: 'Builds and keeps strong bones; only needed when food (milk, tofu, small fish, greens) falls short.',
    benefits: ['Keeps bones strong and lowers fracture risk with vitamin D', 'Supports muscle contraction and nerve function'],
    sideEffects: ['Constipation, gas and bloating', 'Too much raises the risk of kidney stones'],
    dose: 'Daily needs are 1,000 mg for adults 19–50, and 1,200 mg for women over 50 and men over 70, from food and supplements combined. Take no more than 500 mg at a time. Upper limit: 2,500 mg a day (2,000 mg over 50).',
    timing: 'Calcium carbonate with food; calcium citrate any time.',
    cautions: ['Kidney stones or kidney disease: ask your doctor', 'Count calcium from food first; many people do not need a supplement'],
    interactions: ['Take 4 hours apart from levothyroxine', 'Reduces absorption of iron, some antibiotics and bisphosphonates; space them apart'],
    certifications: VITAMIN_MARKS, whereToBuy: PHARMACY, source: NIH('Calcium', 'Calcium'),
  },
  {
    id: 'b12', name: 'Vitamin B12', category: 'Vitamins & minerals', evidence: 'Strong', goals: ['General fitness', 'Endurance'], adultsOnly: false, over50: true,
    summary: 'Needed for red blood cells and nerves. Vegans and many people over 50 need a supplement.',
    benefits: ['Prevents tiredness and anemia caused by low B12', 'Protects nerve health', 'Essential for anyone on a vegan diet'],
    sideEffects: ['Very low risk at usual doses; no upper limit has been set'],
    dose: '2.4 mcg a day is the daily need. Supplements of 25–100 mcg a day are common because only part is absorbed.',
    timing: 'Any time, with or without food.',
    cautions: ['Long-term tiredness or numbness: see a doctor for a blood test rather than self-treating'],
    interactions: ['Metformin and stomach-acid medicines (omeprazole and similar) lower B12 absorption, so users often need it'],
    certifications: VITAMIN_MARKS, whereToBuy: PHARMACY, source: NIH('VitaminB12', 'Vitamin B12'),
  },
  {
    id: 'iron', name: 'Iron', category: 'Vitamins & minerals', evidence: 'Strong', goals: ['Endurance'], adultsOnly: false,
    summary: 'Carries oxygen in the blood. Take it only when a blood test shows you are low.',
    benefits: ['Restores energy and endurance in people with iron deficiency', 'Treats iron-deficiency anemia'],
    sideEffects: ['Constipation, nausea and stomach pain', 'Dark stools', 'Overdose is dangerous, especially for children'],
    dose: 'Daily needs are 8 mg for men and 18 mg for women aged 19–50. Do not exceed 45 mg a day unless a doctor prescribes it.',
    timing: 'On an empty stomach or with vitamin C for better absorption; take apart from coffee, tea, milk and calcium.',
    cautions: ['Only take with a confirmed deficiency; excess iron builds up and harms organs', 'Keep away from children', 'Men and post-menopausal women rarely need it'],
    interactions: ['Take 4 hours apart from levothyroxine', 'Reduces absorption of some antibiotics; stomach-acid medicines reduce iron absorption'],
    certifications: VITAMIN_MARKS, whereToBuy: PHARMACY, source: NIH('Iron', 'Iron'),
  },
  {
    id: 'zinc', name: 'Zinc', category: 'Vitamins & minerals', evidence: 'Moderate', goals: ['General fitness'], adultsOnly: false,
    summary: 'Supports the immune system and wound healing; useful when intake is low, such as in vegetarian diets.',
    benefits: ['Supports immune function', 'Helps wounds heal', 'Corrects low intake'],
    sideEffects: ['Nausea and stomach upset, especially on an empty stomach', 'Long-term high doses cause copper deficiency and lower immunity'],
    dose: 'Daily needs are 11 mg for men and 8 mg for women. Do not exceed 40 mg a day.',
    timing: 'With food to avoid nausea.',
    cautions: ['Do not take high doses for long periods without medical advice'],
    interactions: ['Take 2 hours apart from tetracycline or quinolone antibiotics', 'Thiazide diuretics increase zinc loss'],
    certifications: VITAMIN_MARKS, whereToBuy: PHARMACY, source: NIH('Zinc', 'Zinc'),
  },
  {
    id: 'multivitamin', name: 'Multivitamin and mineral', category: 'Vitamins & minerals', evidence: 'Limited', goals: ['General fitness', 'Weight loss'], adultsOnly: false, over50: true,
    summary: 'A safety net for gaps in a restricted diet. It does not replace a balanced diet.',
    benefits: ['Fills small gaps during calorie-restricted dieting', 'Convenient coverage of many nutrients at once'],
    sideEffects: ['Stomach upset', 'Stacking it with other supplements can push vitamins A, D, iron or zinc above safe limits'],
    dose: 'One serving a day that provides about 100% of the Daily Value, not mega-doses.',
    timing: 'With breakfast or another meal.',
    cautions: ['Men and post-menopausal women usually do not need one with iron', 'Smokers should avoid high-dose beta-carotene products', 'Pregnancy: use a prenatal formula your doctor recommends'],
    interactions: ['Vitamin K in multivitamins can affect warfarin', 'Minerals reduce absorption of some antibiotics and levothyroxine'],
    certifications: VITAMIN_MARKS, whereToBuy: PHARMACY, source: NIH('MVMS', 'Multivitamin/mineral supplements'),
  },
  {
    id: 'psyllium', name: 'Psyllium fiber', category: 'Health & recovery', evidence: 'Strong', goals: ['Weight loss', 'General fitness'], adultsOnly: false,
    summary: 'A soluble fiber that helps fullness, digestion and cholesterol when your diet is low in fiber.',
    benefits: ['Keeps you full for longer while dieting', 'Lowers LDL cholesterol as part of a heart-healthy diet', 'Supports regular bowel movements'],
    sideEffects: ['Gas and bloating at first; increase slowly', 'Can cause choking or blockage if taken without enough water'],
    dose: '5–10 g a day, building up slowly. Mix each dose with at least a full glass (240 ml) of water.',
    timing: 'Before or with meals; take medicines 2 hours apart.',
    cautions: ['Trouble swallowing or a history of bowel blockage: avoid', 'Always drink plenty of water with it'],
    interactions: ['Slows absorption of many medicines, including diabetes and heart medicines: take them 2 hours apart'],
    certifications: ['FDA PH registration', 'USP Verified', 'USDA Organic'], whereToBuy: PHARMACY,
    source: { label: 'U.S. FDA: Dietary supplements overview', url: 'https://www.fda.gov/food/dietary-supplements' },
  },
  {
    id: 'nitrate', name: 'Beetroot juice (dietary nitrate)', category: 'Performance', evidence: 'Moderate', goals: ['Endurance'], adultsOnly: true,
    summary: 'Nitrate from beetroot widens blood vessels and makes endurance work more efficient.',
    benefits: ['Improves efficiency in running, cycling and rowing', 'May delay fatigue in efforts of 5–30 minutes'],
    sideEffects: ['Harmless red or pink urine and stools', 'Stomach upset'],
    dose: 'About 6–8 mmol (roughly 400–500 mg) of nitrate, usually a concentrated beetroot shot.',
    timing: '2–3 hours before endurance exercise.',
    cautions: ['Low blood pressure: ask your doctor', 'Kidney stones: beetroot is high in oxalate'],
    interactions: ['Nitrate heart medicines (nitroglycerin) or erectile dysfunction medicines (sildenafil and similar) can drop blood pressure dangerously: do not combine'],
    certifications: SPORT_MARKS, whereToBuy: SPORT_SHOPS, source: SPORT,
  },
];

/** What each mark actually certifies, so users are not misled by "approved" claims. */
export const CERTIFICATIONS: { mark: Certification; meaning: string; check: { label: string; url: string } }[] = [
  { mark: 'FDA PH registration', meaning: 'The Philippine FDA has registered the product as a food supplement (Certificate of Product Registration). Labels must say "No approved therapeutic claims": registration is not approval as a medicine.', check: { label: 'Verify a product on the FDA Philippines portal', url: 'https://verification.fda.gov.ph/' } },
  { mark: 'USP Verified', meaning: 'An independent lab confirmed the product contains the listed ingredients in the stated amounts, without harmful contaminants, made under good manufacturing practices.', check: { label: 'Browse USP Verified products', url: 'https://www.quality-supplements.org/' } },
  { mark: 'NSF Certified for Sport', meaning: 'Tested for label accuracy, contaminants and substances banned in sport. A strong choice for athletes who are drug tested.', check: { label: 'Search NSF Certified for Sport products', url: 'https://www.nsfsport.com/' } },
  { mark: 'Informed Sport', meaning: 'Every batch is tested for substances banned in sport before release.', check: { label: 'Search Informed Sport products', url: 'https://sport.wetestyoutrust.com/' } },
  { mark: 'USDA Organic', meaning: 'Only means the ingredients were grown and handled to U.S. organic rules. It says nothing about the supplement\'s safety, dose or effect.', check: { label: 'USDA organic labeling rules', url: 'https://www.ams.usda.gov/rules-regulations/organic/labeling' } },
];

export const US_FDA_NOTE = { text: 'In the United States, the FDA does not approve dietary supplements before they are sold. It regulates labels and manufacturing and can act against unsafe products, so independent testing marks are the best proof of quality.', url: 'https://www.fda.gov/food/dietary-supplements' };

const EVIDENCE_RANK = { Strong: 0, Moderate: 1, Limited: 2 };

/** Who the guide is talking to: drives the "For you" list and the safety notices. */
export function supplementAudience(profile: Pick<Profile, 'age' | 'goal' | 'conditions' | 'healthRisks' | 'healthConsentAt'>) {
  const age = Number(profile.age);
  const minor = Number.isFinite(age) && age > 0 && age < 18;
  const over50 = age >= 50;
  // Health data counts only with consent, as elsewhere in the app.
  const health = profile.healthConsentAt ? [...(profile.conditions ?? []), ...(profile.healthRisks ?? [])].filter(Boolean) : [];
  const fits = (item: Supplement) => !(minor && item.adultsOnly) && (item.goals.includes(profile.goal) || (over50 && !!item.over50));
  const ordered = [...SUPPLEMENTS].sort((a, b) => Number(fits(b)) - Number(fits(a)) || EVIDENCE_RANK[a.evidence] - EVIDENCE_RANK[b.evidence]);
  return { minor, over50, health, fits, ordered };
}
