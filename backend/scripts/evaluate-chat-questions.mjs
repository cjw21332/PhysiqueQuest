// Repeated production-service evaluation with synthetic records. No .env, database or real account access.
import 'reflect-metadata';
import { readFile, writeFile } from 'node:fs/promises';
import { CHAT_QUESTION_CASES } from '../dist/chat/chat-question-corpus.js';
import { createChatFixture, CHAT_FIXTURE_OWNER, CHAT_FIXTURE_PRIVATE } from '../dist/chat/testing/chat-fixture.js';
import { LocalChatProvider } from '../dist/chat/local-chat.provider.js';

const parsed = Number(process.argv.find(value => value.startsWith('--passes='))?.split('=')[1] || 3);
if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) throw new Error('Choose one to five passes.');
const provider = new LocalChatProvider({ get: name => process.env[name] });
if (!(await provider.warmup()).ready) throw new Error('Local model warmup failed; real generation cannot be evaluated.');
const count = { generated: 0, semantic: 0 };
const original = provider.generate.bind(provider);
provider.generate = (...args) => { count.generated++; return original(...args); };
const originalRoute = provider.routeQuestion.bind(provider);
provider.routeQuestion = (...args) => { count.semantic++; return originalRoute(...args); };
const reasoning = [
  { id: 'model-plan-versus-settings', question: 'Compare my saved dietary plan calories with my independent saved nutrition target settings.', terms: ['2000|2,000', '2100|2,100|100'] },
  { id: 'model-estimate-limit', question: 'Why can you not say my logged meal calories prove exactly how much I ate?', terms: ['estimate|portion|uncertain|not.*(?:verify|exact)|cannot.*(?:prove|verify)'] },
  { id: 'model-current-versus-target', question: 'Explain why my target weight is different from my current profile weight, using only the saved values.', terms: ['72', '68'], forbidden: ['latest saved measurement|October|2026-10-'] },
  { id: 'model-total-versus-today', question: 'Compare my all-time Quest XP with my mission points earned today.', terms: ['640', '160'] },
  { id: 'model-outside-app', question: 'PhysiqueQuest: what is the capital of France?', terms: ['Please ask about something in PhysiqueQuest'], forbidden: ['Paris'] },
  { id: 'model-food-portions', question: 'Why should I review my estimated food portions before treating the saved calories as exact?', terms: ['estimate|portion|not.*exact|accurac'], forbidden: ['2,?100'] },
  { id: 'model-water-mission', question: 'Why is my saved water mission still incomplete?', terms: ['6|six', '8|eight'] },
  { id: 'model-form-verification', question: 'Why can you not verify my exercise form from my saved workout records?', terms: ['cannot|can.t|not|unable', 'form|camera|video'], forbidden: ['app (?:lacks|has no) camera'] },
  { id: 'model-history-limit', question: 'Explain why my recent food history should not be treated as my complete meal history.', terms: ['excerpt|bounded', 'older|limit'] },
  { id: 'model-profile-progress-semantics', question: 'Why would my profile weight and Progress check-ins have different saved values?', terms: ['profile', 'check.in|progress', 'separate|different'], forbidden: ['profile.*(?:measured on|dated)|latest.*profile.*2026'] },
  { id: 'model-program-preferences', question: 'Explain the distinction between my saved Coach snapshot and my training preferences without guessing which is newer.', terms: ['snapshot|program', 'preferences', 'cannot|can.t|not|unavailable|unknown|may'], forbidden: ['snapshot is (?:definitely |clearly )?newer|preferences are (?:definitely |clearly )?newer'] },
  { id: 'model-workout-evidence', question: 'Why does my saved workout load not prove that my strength improved over time?', terms: ['load|strength', 'not|cannot|can.t', 'history|time|compar|multiple|trend'], forbidden: ['your strength (?:has|definitely) improved'] },
  { id: 'model-notification-versus-safety', question: 'Explain why my unread notifications cannot confirm delivery of a safety alert.', terms: ['notification', 'safety|alert', 'separate|different|cannot|not'], forbidden: ['unread count (?:proves|confirms)'] },
  { id: 'reasoning-plan-and-intake', question: 'Why might my saved diet plan target more calories than I have logged today?', expectDirect: true, terms: ['2,?000', '1,?500', 'target|plan', 'logged|record'], forbidden: ['you (?:definitely |actually )?ate only', '2,?100'] },
  { id: 'reasoning-interpret-intake', question: 'What should I keep in mind when interpreting my saved dietary plan alongside my logged intake today?', expectDirect: true, terms: ['2,?000', '1,?500', 'estimate|unlogged|not.*(?:actual|verify|proof)|cannot', '150 g', '90 g', '60 g'], forbidden: ['you (?:must|should) eat exactly', '(?:met|reached) your protein goal', 'differs from standard scientific'] },
  { id: 'reasoning-weight-trend', question: 'What should I keep in mind before drawing a weight trend from my saved Progress check-ins?', expectDirect: true, terms: ['71', 'trend', 'more|multiple|single|one|insufficient|cannot|not enough'], forbidden: ['you have lost|your weight is (?:steadily )?(?:decreasing|increasing)', 'current weight.*71'] },
  { id: 'reasoning-reminder-delivery', question: 'Why might my daily reminder fail to reach my phone even though it is enabled?', expectModel: true, terms: ['09:05|9:05', 'Asia/Singapore', 'permission|push|provider'], forbidden: ['notification permission is disabled', 'your push provider is not configured'] },
  { id: 'reasoning-session-timer', question: 'Why can my saved completed workout not confirm the live state of my current session timer?', expectDirect: true, terms: ['saved|record', 'timer|device', 'cannot|not|unavailable|unknown'], forbidden: ['your timer is currently', 'your current session has lasted'] },
  { id: 'reasoning-quest-versus-rank', question: 'Why does my current Quest level not tell you my leaderboard position?', expectDirect: true, terms: ['7', 'leaderboard|ranking', 'unavailable|cannot|not|unknown'], forbidden: ['you rank|your rank is|you are ranked'] },
  { id: 'reasoning-prescribed-versus-completed', question: 'What should I consider when comparing my saved completed sets to my prescribed Coach sets?', expectDirect: true, terms: ['prescrib|prescription|plan', 'saved|record', 'not|cannot|self.reported'], forbidden: ['verified your form', 'proved.*strength', 'matching.*prescription exactly'] },
  { id: 'reasoning-safety-status', question: 'How should I interpret my saved safety alert status without assuming a person received it?', expectModel: true, terms: ['delivered', 'guarantee|cannot confirm|does not (?:prove|confirm|guarantee)|not.*guarantee|cannot.*(?:guarantee|verify)'], forbidden: ['your contact (?:definitely )?received'] },
  { id: 'reasoning-manual-versus-camera', question: 'What should I know about camera readiness versus manual logging in Coach?', expectModel: true, terms: ['camera', 'manual', 'optional|without|permission|off'], forbidden: ['camera is required', 'must enable.*camera'] },
  { id: 'reasoning-food-estimates', question: 'What should I keep in mind about food photo estimates before saving an entry in Scan?', expectModel: true, terms: ['estimat|portion|inaccur|wrong', 'review|correct|adjust'], forbidden: ['always accurate', 'guaranteed.*calories'] },
];
const originalOnly = process.argv.includes('--original-only');
const corpusCases = CHAT_QUESTION_CASES.flatMap(item => {
  const phrasings = [
    ['original', item.question],
    ['uppercase', item.question.toUpperCase()],
    ['lowercase', item.question.toLowerCase()],
    ['polite-prefix', 'Please ' + item.question],
    ['extra-whitespace', ' \t' + item.question.replace(/\s+/g, '  ') + '\n  '],
    ['curly-apostrophes', item.question.replace(/'/g, '’')],
  ];
  return phrasings.filter(([variant]) => !originalOnly || variant === 'original').map(([variant, question]) => {
    const conversation = item.conversation?.map(message => ({ ...message }));
    if (conversation) {
      let lastUser = -1;
      conversation.forEach((message, index) => { if (message.role === 'user') lastUser = index; });
      if (lastUser >= 0) conversation[lastUser] = { ...conversation[lastUser], text: question };
    }
    return { ...item, question, conversation, variant };
  });
});
let evaluationCases = [
  ...corpusCases,
  ...reasoning.map(item => ({ ...item, personal: true, outcome: 'reasoning', variant: 'original' })),
];
const failedOnly = process.argv.includes('--failed-only');
if (failedOnly) {
  const prior = JSON.parse(await readFile(new URL('../../ai/question-evaluation-before-semantic-constraints.json', import.meta.url), 'utf8'));
  const ids = new Set(prior.failures.map(item => item.id));
  evaluationCases = evaluationCases.filter(item => ids.has(item.id));
}
const onlyArgument = process.argv.find(value => value.startsWith('--only='));
const selectedIds = onlyArgument?.slice('--only='.length).split(',').filter(Boolean);
if (selectedIds) {
  const unknown = selectedIds.filter(id => !evaluationCases.some(item => item.id === id));
  if (unknown.length) throw new Error('Unknown evaluation IDs: ' + unknown.join(', '));
  evaluationCases = evaluationCases.filter(item => selectedIds.includes(item.id));
}
const samples = [], failures = [], outcomes = [], timings = { direct: [], model: [], semantic: [] };
let checked = 0;
for (let pass = 1; pass <= parsed; pass++) {
  let passed = 0;
  for (const item of evaluationCases) {
    const fixture = createChatFixture(provider, item.scenario);
    const started = performance.now(), before = count.generated, beforeSemantic = count.semantic;
    try {
      const messages = item.conversation ? [...item.conversation] : [{ role: 'user', text: item.question }];
      const answer = await fixture.service.reply(CHAT_FIXTURE_OWNER, messages, item.personal, item.page);
      const elapsedMs = Math.round(performance.now() - started), mode = count.generated !== before ? 'model' : count.semantic !== beforeSemantic ? 'semantic' : 'direct';
      timings[mode].push(elapsedMs);
      const issues = [];
      if (item.expectModel && mode === 'direct') issues.push('Reasoning probe did not exercise the real local model');
      if (item.expectDirect && mode === 'model') issues.push('Exact analytics were delegated to answer generation');
      for (const value of item.requiredTerms ?? item.terms ?? []) if (!new RegExp(value, 'i').test(answer.reply)) issues.push('Missing expected fact: ' + value);
      for (const value of item.forbiddenTerms ?? item.forbidden ?? []) if (new RegExp(value, 'i').test(answer.reply)) issues.push('Forbidden claim: ' + value);
      if (item.outcome !== 'boundary' && item.id !== 'model-outside-app' && answer.reply.includes('Please ask about something in PhysiqueQuest')) issues.push('False scope refusal');
      if (item.outcome === 'data' && (!answer.privacy.personalDataIncluded || !answer.sources.some(source => source.id.startsWith('user-')))) issues.push('Did not answer from own records');
      if (item.outcome === 'data' && item.sourceIds && !answer.sources.some(source => item.sourceIds.includes(source.id))) issues.push('Wrong record domain');
      if (['guide','consent','boundary','clarify'].includes(item.outcome) && fixture.calls.length) issues.push('Unnecessary personal read');
      if (fixture.calls.some(call => call.owner !== CHAT_FIXTURE_OWNER)) issues.push('Owner mismatch');
      if (JSON.stringify(answer).includes(CHAT_FIXTURE_PRIVATE) || /(?:^|\n)\s*(?:sources?|references?):/i.test(answer.reply)) issues.push('Private sentinel or source footer');
      if (issues.length) failures.push({ pass, id: item.id, variant: item.variant, question: item.question, issues, reply: answer.reply });
      else passed++;
      outcomes.push({ pass, id: item.id, variant: item.variant, question: item.question, passed: issues.length === 0, mode, elapsedMs, sourceIds: answer.sources.map(source => source.id) });
      if (issues.length) console.log('FAIL ' + item.id + ': ' + issues.join('; '));
      if (pass === 1 && item.variant === 'original' && (item.id === 'diet-exact-reported' || item.id === 'quests-points-total' || item.outcome === 'reasoning')) samples.push({ id: item.id, question: item.question, reply: answer.reply, elapsedMs, mode });
    } catch {
      failures.push({ pass, id: item.id, variant: item.variant, question: item.question, issues: ['Generation or request unavailable/invalid'] });
      outcomes.push({ pass, id: item.id, variant: item.variant, question: item.question, passed: false, mode: 'unavailable' });
    }
    checked++;
    if (checked % 50 === 0) console.log('Checked ' + checked + ' responses; failures so far: ' + failures.length + '.');
  }
  console.log('Pass ' + pass + ': ' + passed + '/' + evaluationCases.length + ' passed.');
}
const stats = values => { const sorted = [...values].sort((a,b)=>a-b); return { count: sorted.length, medianMs: sorted[Math.floor(sorted.length/2)] ?? null, p95Ms: sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)] ?? null, maxMs: sorted.at(-1) ?? null }; };
const report = {
  checkedAt: new Date().toISOString(), syntheticOnly: true, passes: parsed,
  originalOnly,
  filteredToPriorFailures: failedOnly,
  selectedIds: selectedIds ?? null,
  distinctQuestions: new Set(evaluationCases.map(item => item.id)).size,
  corpusPhrasingsPerPass: evaluationCases.filter(item => item.outcome !== 'reasoning').length,
  totalChecksPerPass: evaluationCases.length,
  checked, passed: checked - failures.length, failed: failures.length,
  modelGenerations: count.generated,
  semanticResolutions: count.semantic,
  latency: { direct: stats(timings.direct), model: stats(timings.model), semantic: stats(timings.semantic) },
  samples, failures, outcomes,
};
await writeFile(new URL('../../ai/question-evaluation-latest.json', import.meta.url), JSON.stringify(report,null,2) + '\n');
provider.onModuleDestroy();
if (failures.length) {
  console.log('Failed cases: ' + failures.map(item => item.id + ' (pass ' + item.pass + ')').join(', '));
  process.exitCode = 1;
} else console.log('All repeated question evaluations passed; report saved to ai/question-evaluation-latest.json.');
