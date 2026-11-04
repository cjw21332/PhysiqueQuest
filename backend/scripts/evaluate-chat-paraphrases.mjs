// Unlisted paraphrases through the real local semantic router and production service.
// Synthetic owner records only; no .env, MongoDB, real accounts or training changes.
import 'reflect-metadata';
import { readFile, writeFile } from 'node:fs/promises';
import { createChatFixture, CHAT_FIXTURE_OWNER, CHAT_FIXTURE_PRIVATE } from '../dist/chat/testing/chat-fixture.js';
import { LocalChatProvider } from '../dist/chat/local-chat.provider.js';
import { CHAT_SEMANTIC_ROUTES, needsSemanticRouting } from '../dist/chat/chat-semantic-router.js';

const passes = Number(process.argv.find(arg => arg.startsWith('--passes='))?.split('=')[1] ?? 2);
if (!Number.isInteger(passes) || passes < 1 || passes > 5) throw new Error('Choose one to five passes.');
const probes = [
  { id: 'plan-blueprint', question: "What's the eating blueprint I've settled on?", ids: ['nutrition.plan'], terms: ['Maintenance', '2000 kcal', '150 g/day'] },
  { id: 'plan-setup', question: 'Can you remind me of the nutrition setup I committed to?', ids: ['nutrition.plan'], terms: ['Maintenance', '2000 kcal'] },
  { id: 'plan-regimen', question: 'Lay out the food regimen currently attached to my account.', anyIds: ['nutrition.plan', 'nutrition.plan-name'], terms: ['Maintenance', '2000 kcal'], forbidden: ['2100', 'Quest level'] },
  { id: 'plan-strategy', question: 'In plain terms, what eating strategy is on file for me?', anyIds: ['nutrition.plan', 'nutrition.plan-name'], terms: ['Maintenance', '2000 kcal'], forbidden: ['2100', 'Quest level'] },
  { id: 'energy-allowance', question: "What's the energy allowance I set for each day?", ids: ['nutrition.calorie-target'], terms: ['2000 kcal'], forbidden: ['2100'] },
  { id: 'energy-ceiling', question: 'What is my daily kcal ceiling supposed to be?', ids: ['nutrition.calorie-target'], terms: ['2000 kcal'] },
  { id: 'nutrient-split', question: "Can you show the nutrient split I'm aiming to hit?", ids: ['nutrition.macro-targets'], terms: ['30%', '40%', '150 g/day', '200 g/day', '67 g/day'] },
  { id: 'nutrient-blueprint', question: 'How do the three main nutrients divide up in my chosen eating blueprint?', ids: ['nutrition.macro-targets'], terms: ['30%', '40%', '150 g/day'] },
  { id: 'plate-today', question: 'List what has gone onto my plate since I woke up.', ids: ['nutrition.meals'], terms: ['Oatmeal', 'Rice bowl'], forbidden: ['Chicken salad'] },
  { id: 'plate-previous-day', question: 'Which bites did I put on record the previous day?', ids: ['nutrition.meals'], terms: ['Chicken salad'], forbidden: ['Oatmeal'] },
  { id: 'energy-tally', question: "What's my energy tally so far since waking up?", anyIds: ['nutrition.calories-logged', 'nutrition.intake'], terms: ['1500 kcal'], forbidden: ['Daily calorie target'] },
  { id: 'hydration-cups', question: 'How many hydration cups have I ticked off so far?', ids: ['nutrition.water'], terms: ['6 glasses'] },
  { id: 'calories-unused', question: 'How much of my calorie allowance is still unused today?', ids: ['nutrition.calories-remaining'], terms: ['500 kcal', '2000', '1500'] },
  { id: 'gym-blueprint', question: "What's the gym blueprint I've committed to for the week?", ids: ['workout.program'], terms: ['Monday', 'Strength day', '45 min'] },
  { id: 'sweat-movements', question: 'Which movements showed up in my most recent sweat session?', ids: ['workout.latest-exercises'], terms: ['Squat'] },
  { id: 'gym-effort-length', question: 'How many minutes did that last gym effort take?', ids: ['workout.latest-duration'], terms: ['40 min'], forbidden: ['planned session duration'] },
  { id: 'available-iron', question: 'What iron have I said I can train with?', ids: ['training.equipment'], terms: ['Dumbbells'] },
  { id: 'body-mass', question: "What's the body mass currently entered against my profile?", ids: ['profile.weight'], terms: ['72 kg'], forbidden: ['68 kg', '71 kg'] },
  { id: 'stature', question: 'How tall did I say I was when signing up?', ids: ['profile.height'], terms: ['175 cm'] },
  { id: 'scale-destination', question: 'Which number on the scale am I ultimately trying to reach?', ids: ['profile.target-weight'], terms: ['68 kg'], forbidden: ['72 kg'] },
  { id: 'quest-stage', question: 'What stage of the Quest ladder am I on?', ids: ['quests.level'], terms: ['level is 7'] },
  { id: 'xp-shortfall', question: 'How far short am I of the next XP step?', ids: ['quests.remaining-xp'], terms: ['60'], forbidden: ['40 XP toward'] },
  { id: 'daily-nudge', question: 'What hour did I pick for my daily nudge?', ids: ['notifications.reminder'], terms: ['09:05', 'Asia/Singapore'] },
  { id: 'ranking-exposure', question: 'Is the app set up to let others see me in the rankings?', ids: ['settings.visibility'], terms: ['hidden'] },
  { id: 'supper-correction', question: 'I made a typo in a supper entry. Where can I fix it?', ids: ['guide.scan-edit-meal'], terms: ['/scan/edit-meal'], guide: true },
  { id: 'parked-workout', question: 'How do I get back into a workout I parked earlier?', ids: ['guide.resume-workout'], terms: ['Resume saved workout'], guide: true },
  { id: 'contact-person', question: "Remind me who's listed as my person to call if something goes wrong.", ids: ['profile.contact-name'], terms: ['Emergency Person'], forbidden: ['555', 'Sibling'] },
  { id: 'two-fields', question: 'Give me my energy allowance alongside my body mass.', ids: ['nutrition.calorie-target', 'profile.weight'], terms: ['2000 kcal', '72 kg'] },
  { id: 'mixed-literal-and-alias', question: 'Tell me my current weight together with the energy allowance I chose.', ids: ['profile.weight', 'nutrition.calorie-target'], terms: ['72 kg', '2000 kcal'], forbidden: ['68 kg'] },
  { id: 'protein-and-body-mass', question: 'Give me my protein target and the body mass on my profile.', ids: ['nutrition.protein-target', 'profile.weight'], terms: ['150 g/day', '72 kg'], forbidden: ['68 kg'] },
  { id: 'meal-intake-and-target', question: "How much protein did I log at breakfast, and what's my calorie allowance?", ids: ['nutrition.calorie-target'], terms: ['15 g', '2000 kcal'], forbidden: ['90 g'] },
  { id: 'fragment-energy', question: 'And the energy part?', ids: ['nutrition.calorie-target'], terms: ['2000 kcal'], previous: ["What's the eating blueprint I've settled on?"] },
  { id: 'implicit-plan-page', question: 'Which blueprint am I following?', page: '/scan', ids: ['nutrition.plan'], terms: ['Maintenance', '2000 kcal'] },
  { id: 'ambiguous-blueprint', question: 'Which blueprint am I following?', terms: ['clarify|which|mean'], noReads: true, deterministicClarification: true },
  { id: 'outside-holiday', question: 'Plan a weekend in Kyoto for me.', decision: 'out_of_scope', terms: ['Please ask about something in PhysiqueQuest'], noReads: true },
  { id: 'other-plate', question: "Peek at the other guy's plate for me.", terms: ['cannot access another user'], noReads: true, deterministicBoundary: true },
  { id: 'consent-energy', question: 'What daily energy allowance did I choose?', ids: ['nutrition.calorie-target'], personal: false, terms: ['Enable.*saved fitness data'], forbidden: ['2000'], noReads: true },
  { id: 'empty-regimen', question: 'Lay out the food regimen currently attached to my account.', anyIds: ['nutrition.plan', 'nutrition.plan-name'], scenario: 'empty', terms: ['No saved dietary plan'], forbidden: ['Maintenance', '2000'] },
];
const provider = new LocalChatProvider({ get: key => process.env[key] });
if (!(await provider.warmup()).ready) throw new Error('The local semantic model is unavailable.');
let questionGenerationCalls = 0;
if (process.argv.includes('--fresh')) {
  const selected = ['plan-blueprint', 'energy-allowance', 'nutrient-split', 'plate-today', 'hydration-cups', 'gym-blueprint', 'sweat-movements', 'body-mass', 'stature', 'scale-destination', 'xp-shortfall', 'daily-nudge'].map(id => probes.find(probe => probe.id === id));
  const intents = selected.map((item, index) => ({ id: String(index), intent: item.id === 'hydration-cups' ? 'How many glasses of water have I logged today?' : CHAT_SEMANTIC_ROUTES.find(route => route.id === item.ids[0]).question.replace('{time}', 'today') }));
  const writer = new LocalChatProvider({ get: key => key === 'CHAT_MAX_OUTPUT_TOKENS' ? '1600' : process.env[key] });
  let alternatives;
  try {
    questionGenerationCalls++;
    const generated = await writer.generate([
      { role: 'system', content: 'Create test questions for the PhysiqueQuest app. Rewrite each supplied intent as one natural first-person user question with different wording or word order and at least ten words. Preserve the EXACT requested fact, ownership and timeframe. Do not turn a record question into instructions. Do not answer it or invent facts. Avoid blueprint, regimen, energy allowance, ceiling, sweat session, nudge and ladder, which are already tested. In answer, put a JSON array of objects with exactly id and question; each supplied id must appear once. Return inScope=true and sourceIds=["evaluation-intents"].' },
      { role: 'user', content: JSON.stringify(intents) },
    ], ['evaluation-intents']);
    alternatives = JSON.parse(generated.answer);
    if (!Array.isArray(alternatives) || alternatives.length !== intents.length || new Set(alternatives.map(item => item.id)).size !== intents.length || alternatives.some(item => !intents.some(intent => intent.id === item.id) || typeof item.question !== 'string' || item.question.length < 10 || item.question.length > 500 || Object.keys(item).some(key => !['id', 'question'].includes(key)) || !needsSemanticRouting(item.question))) throw new Error('Generated paraphrases are invalid or merely repeat a canonical question.');
    const fresh = alternatives.map(item => ({ ...selected[Number(item.id)], id: 'fresh-' + item.id, question: item.question }));
    for (const item of fresh) {
      if (item.ids?.includes('nutrition.water') && /\b(?:ounces?|oz|millilitres?|ml|litres?)\b/i.test(item.question)) { item.terms = [...item.terms, 'cannot.*(?:derive|convert)']; item.forbidden = [...(item.forbidden ?? []), '6 (?:ounces|oz|ml|litres)']; }
      if (item.ids?.includes('workout.program') && /\bexercises\b/i.test(item.question)) { item.anyIds = ['workout.program', 'workout.program-exercises']; delete item.ids; item.terms = [...item.terms, 'Squat']; }
    }
    await writeFile(new URL('../../ai/generated-paraphrases-latest.json', import.meta.url), JSON.stringify({ syntheticOnly: true, intents, questions: fresh }, null, 2) + '\n');
    for (const item of fresh) console.log('FRESH ' + item.id + ': ' + item.question);
    probes.push(...fresh);
  } finally { writer.onModuleDestroy(); }
}
if (process.argv.includes('--replay-fresh')) {
  const saved = JSON.parse(await readFile(new URL('../../ai/generated-paraphrases-latest.json', import.meta.url), 'utf8'));
  const selected = ['plan-blueprint', 'energy-allowance', 'nutrient-split', 'plate-today', 'hydration-cups', 'gym-blueprint', 'sweat-movements', 'body-mass', 'stature', 'scale-destination', 'xp-shortfall', 'daily-nudge'].map(id => probes.find(probe => probe.id === id));
  for (const item of saved.questions) {
    const index = Number(item.id.replace('fresh-', ''));
    const probe = { ...selected[index], ...item };
    if (!probe.terms) throw new Error('Saved synthetic intent is invalid.');
    if (probe.ids?.includes('nutrition.water') && /\b(?:ounces?|oz|millilitres?|ml|litres?)\b/i.test(probe.question)) { probe.terms = [...probe.terms, 'cannot.*(?:derive|convert)']; probe.forbidden = [...(probe.forbidden ?? []), '6 (?:ounces|oz|ml|litres)']; }
    if (probe.ids?.includes('workout.program') && /\bexercises\b/i.test(probe.question)) { probe.anyIds = ['workout.program', 'workout.program-exercises']; delete probe.ids; probe.terms = [...probe.terms, 'Squat']; }
    probes.push(probe);
  }
}
let routeCalls = 0, generations = 0, lastPlan;
const route = provider.routeQuestion.bind(provider), generate = provider.generate.bind(provider);
provider.routeQuestion = async (...args) => { routeCalls++; lastPlan = await route(...args); return lastPlan; };
provider.generate = (...args) => { generations++; return generate(...args); };
const results = [];
const onlyIds = process.argv.find(arg => arg.startsWith('--only='))?.slice('--only='.length).split(',');
const evaluatedProbes = onlyIds ? probes.filter(probe => onlyIds.includes(probe.id)) : probes;
if (!evaluatedProbes.length) throw new Error('No matching synthetic probes.');
try {
  for (let pass = 1; pass <= passes; pass++) {
    for (const item of evaluatedProbes) {
      const fixture = createChatFixture(provider, item.scenario);
      const before = routeCalls, generatedBefore = generations, started = performance.now();
      lastPlan = undefined;
      try {
        const messages = [...(item.previous ?? []).map(text => ({ role: 'user', text })), { role: 'user', text: item.question }];
        const answer = await fixture.service.reply(CHAT_FIXTURE_OWNER, messages, item.personal !== false, item.page);
        const issues = [];
        if (routeCalls === before && !item.deterministicBoundary && !item.deterministicClarification) issues.push('Did not exercise the real semantic fallback');
        if (generations !== generatedBefore) issues.push('Generated record values instead of executing a closed route');
        if (item.decision && lastPlan?.decision !== item.decision) issues.push('Wrong scope/clarification decision');
        if (item.ids?.some(id => !lastPlan?.routeIds.includes(id))) issues.push('Wrong or incomplete route selection');
        if (item.anyIds && !item.anyIds.some(id => lastPlan?.routeIds.includes(id))) issues.push('No route supports the requested fact');
        for (const pattern of item.terms ?? []) if (!new RegExp(pattern, 'i').test(answer.reply)) issues.push('Missing fact: ' + pattern);
        for (const pattern of item.forbidden ?? []) if (new RegExp(pattern, 'i').test(answer.reply)) issues.push('Forbidden claim: ' + pattern);
        if ((item.guide || item.noReads) && fixture.calls.length) issues.push('Unexpected personal read');
        if (fixture.calls.some(call => call.owner !== CHAT_FIXTURE_OWNER)) issues.push('Owner mismatch');
        if (JSON.stringify(answer).includes(CHAT_FIXTURE_PRIVATE)) issues.push('Excluded field leak');
        results.push({ pass, id: item.id, question: item.question, passed: !issues.length, plan: lastPlan, elapsedMs: Math.round(performance.now() - started), reply: answer.reply, issues });
      } catch {
        results.push({ pass, id: item.id, question: item.question, passed: false, plan: lastPlan, elapsedMs: Math.round(performance.now() - started), issues: ['Unavailable/invalid request'] });
      }
      console.log(`${results.at(-1).passed ? 'PASS' : 'FAIL'} ${item.id} (pass ${pass})`);
      if (!results.at(-1).passed) console.log(JSON.stringify({ issues: results.at(-1).issues, plan: results.at(-1).plan, reply: results.at(-1).reply }));
    }
  }
} finally { provider.onModuleDestroy(); }
const report = { checkedAt: new Date().toISOString(), syntheticOnly: true, passes, distinctQuestions: evaluatedProbes.length, checked: results.length, passed: results.filter(row => row.passed).length, failed: results.filter(row => !row.passed).length, semanticModelCalls: routeCalls, questionGenerationCalls, answerGenerations: generations, results };
await writeFile(new URL('../../ai/paraphrase-evaluation-latest.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.passed}/${report.checked} paraphrase checks passed; ${routeCalls} actual semantic-model calls.`);
if (report.failed) process.exitCode = 1;
