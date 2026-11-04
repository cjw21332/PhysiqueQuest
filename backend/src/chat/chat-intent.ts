import { resolveChatPage, selectChatPages } from './chat-pages.js';

export type ChatTopic = 'nutrition' | 'coach' | 'quests' | 'profile' | 'notifications' | 'safety' | 'settings' | 'overview';
export type ChatIntent = { normalized: string; topics: ChatTopic[]; personal: boolean; guide: boolean; ambiguousPlan: boolean };

/** Shared vocabulary for scope, retrieval and exact answers; never an authorization check. */
export function normalizeChatQuestion(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()
    .replace(/^(?:hi(?: phiq)?[,!:\s]+|please help:\s*|please\s+)+/g, '')
    .replace(/\bwhat['’]s\b/g, 'what is').replace(/\bwhere['’]s\b/g, 'where is')
    .replace(/\bi['’]m\b/g, 'i am').replace(/\bi['’]ve\b/g, 'i have')
    .replace(/\bwhat(?:s)\b/g, 'what is')
    .replace(/\b(?:diet(?:ary)?|eating|nutrition(?:al)?|meal)[ -]+(?:plan|program|programme)\b/g, 'dietary plan')
    .replace(/\b(?:work[ -]?out|training|gym|exercise)[ -]+(?:plan|program|programme|routine)\b/g, 'workout program')
    .replace(/\b(?:work-out|work out)\b/g, 'workout')
    .replace(/\b(?:calorie|kcal|cals)\b/g, 'calories')
    .replace(/\bcarbohydrates?\b/g, 'carbs')
    .replace(/\b(?:h2o|fluids?)\b/g, 'water')
    .replace(/\bcheck[ -]?in reminder\b/g, 'daily reminder')
    .replace(/\bbody[ -]?weight\b/g, 'weight')
    .replace(/\bcurent\b/g, 'current')
    .replace(/\bcarb\b/g, 'carbs')
    .replace(/\bfats\b/g, 'fat')
    .replace(/\bwhat am i working toward\b/g, 'what is my fitness goal')
    .replace(/\bhow (?:much do i weigh|heavy am i)\b/g, 'what is my current weight')
    .replace(/\bhow tall am i\b/g, 'what is my height')
    .replace(/\bhow old am i\b/g, 'what is my age')
    .replace(/\bweight am i aiming for\b/g, 'my target weight')
    .replace(/\bmy plan's (?=(?:protein|carbs|fat|macro))/g, 'my dietary plan ')
    .replace(/\s+/g, ' ').trim();
}

const TOPICS: Array<[ChatTopic, RegExp]> = [
  ['nutrition', /\b(?:diet(?:ary)?|nutrition(?:al)?|food|foods|eat|eaten|ate|eating|meal(?:s)?|macros?|protein|carbs|fats?|calories|water|hydration|drank|drink|drinking|breakfast|lunch|dinner|snacks?|portions?|servings?|scan)\b/i],
  ['coach', /\b(?:coach|workouts?|train(?:ing)?|exercise(?:s)?|routine|program(?:me)?|session(?:s)?|reps?|sets?|lift(?:s|ing)?|squat|deadlift|push.?up|lunge|plank|press|row|rest days?|recovery|strength|progressive overload|form|calendar|weekly schedule)\b/i],
  ['quests', /\b(?:quests?|missions?|streak|badges?|points?|xp|experience|levels?|earned|rank(?:ing)?|leaderboard|personal record|pr)\b/i],
  ['profile', /\b(?:profile|personal data|my name|name did i save|name in my profile|who am i|my age|age did i save|how old am i|my gender|gender did i save|my sex|sex did i save|seriousness|goals?|weight|height|target|measurements?|waist|chest|arms?|equipment|weekdays?|training preference|availability|health|conditions?|injur(?:y|ies)|emergency contact|contact (?:name|phone|number|relationship))\b/i],
  ['notifications', /\b(?:notif(?:ication)?s?|reminders?|unread|check[ -]?in|push notification|daily reminder)\b/i],
  ['safety', /\b(?:safety|emergency|alert(?:s)?|inactivity event|delivered|cancelled|canceled)\b/i],
  ['settings', /\b(?:settings|preferences?|inactivity|threshold|alarm|visibility|visible|notification setting)\b/i],
  ['overview', /\b(?:home (?:overview|summary)|dashboard|my (?:data|records|summary)|overall progress)\b|how am i doing|am i on track|what should i do today/i],
];

export function classifyChatQuestion(question: string, page?: string): ChatIntent {
  const normalized = normalizeChatQuestion(question);
  let topics = TOPICS.filter(([, pattern]) => pattern.test(normalized)).map(([topic]) => topic);
  const current = resolveChatPage(page);
  const procedural = /\bhow (?:do|can|should|to) (?:i |we |you )?(?:open|find|view|use|log|add|edit|change|update|delete|export|save|start|pause|resume|finish|complete|set|enable|disable|turn|calibrat\w*|scan|search|check|read|reset|sign|register|recover|upload|switch|cancel|navigate|access|see)\b|\bwhere (?:can|do|should|is|are) (?:i |we |the )?(?:open|find|view|use|log|add|edit|change|update|delete|export|save|set|see|my .* (?:page|screen)|the .* (?:page|screen))\b/i.test(normalized);
  const contextual = /\b(?:this (?:page|screen|section)|here|these controls|this feature)\b/i.test(normalized);
  const statusQuestion = /\b(?:where am i|how am i|what have i|what did i|have i|am i|do i have|when is my|when did i|what time is my|my current|my active|my saved|my latest|my recent)\b/i.test(normalized);
  const ownership = /\b(?:my|mine|for me|i (?:have|logged|ate|eat|eaten|drank|weigh|earned|completed|saved|am|selected|scheduled)|(?:did|have) i (?:save|record|log|add|set|select|choose)|have i|am i|do i have)\b/i.test(normalized);
  const recordCue = /\b(?:current|active|saved|latest|recent|today|yesterday|earned|logged|recorded|completed|remaining|left|still need|so far)\b/i.test(normalized);
  const capability = /\b(?:what (?:data|information) (?:can|do) you|can you (?:access|read|see|store|save|train on|share|modify|export)|do you (?:access|store|save|train on|share))\b/i.test(normalized);
  const explanation = /\b(?:how (?:does|do|is|are)|what (?:is|are|does)|explain|tell me about|help me (?:use|understand))\b/i.test(normalized);
  const navigation = /\b(?:where (?:is|are|can i find)|which (?:page|screen)|take me to|how to get to)\b/i.test(normalized) && !/\bwhere am i\b/i.test(normalized);
  const globalHelp = /\b(?:what can (?:i|you) do|what (?:pages|screens|features)|which (?:pages|screens|features))\b/i.test(normalized);
  const personal = !procedural && !navigation && !capability && (ownership || (recordCue && topics.length > 0) || statusQuestion || topics.includes('overview'));
  const guide = procedural || navigation || capability || globalHelp || (contextual && !personal) || (explanation && !personal) || (!personal && Boolean(current) && (topics.length > 0 || selectChatPages(normalized, page, 1).length > 0));
  let ambiguousPlan = false;
  if (/\b(?:plan|schedule)\b/i.test(normalized) && !topics.includes('nutrition') && !topics.includes('coach')) {
    if (current?.section === 'Scan') topics.push('nutrition');
    else if (current?.section === 'Coach') topics.push('coach');
    else if (personal) ambiguousPlan = true;
  }
  if (current && contextual && !topics.length) {
    if (current.section === 'Scan') topics.push('nutrition');
    else if (current.section === 'Coach') topics.push('coach');
    else if (current.section === 'Quests') topics.push('quests');
    else if (current.section === 'Me') topics.push('profile');
    else if (current.section === 'Home') topics.push('overview');
  }
  if (!topics.length && /\b(?:summary|overview)\b|how am i doing|am i on track|what should i do today/i.test(normalized)) topics.push('overview');
  // Related spelling variants should be accepted through the reviewed page index.
  if (!topics.length) {
    const selected = selectChatPages(normalized, page, 1)[0];
    if (selected && personal) {
      if (selected.section === 'Scan') topics.push('nutrition');
      else if (selected.section === 'Coach') topics.push('coach');
      else if (selected.section === 'Quests') topics.push('quests');
      else if (selected.section === 'Me') topics.push('profile');
      else if (selected.section === 'Home') topics.push('overview');
    }
  }
  topics = [...new Set(topics)];
  if (/\btraining preferences?\b/.test(normalized) && !/\b(?:settings|inactivity|alarm|visibility|threshold|notifications?)\b/.test(normalized)) topics = topics.filter(topic => topic !== 'settings');
  return { normalized, topics, personal, guide, ambiguousPlan };
}

export function resolveChatFollowUp(question: string, previousQuestions: readonly string[], page?: string): string {
  const intent = classifyChatQuestion(question, page);
  if (previousQuestions.length === 0 || question.length > 180) return question;
  // A page can make a fragment look like help. Resolve explicit continuations first,
  // while preserving standalone definitions, procedures and new personal topics.
  const continuation = /^(?:and\b|what about\b|how about\b|why\b|how so\b|tell me more\b)|\b(?:that|those|it|the next one|more until)\b/i.test(intent.normalized);
  const fragment = /^(?:and|what about|how about)\s+(?:(?:my|the)\s+)?(?:calories|protein|carbs|fat|macros|water|today|yesterday|\d{4}-\d{2}-\d{2})[?!.]*$/.test(intent.normalized);
  if (!continuation || (intent.personal && intent.topics.length && !fragment)) return question;
  if (intent.guide && !/^(?:and\b|what about\b|how about\b|why\b|how so\b|tell me more\b)/i.test(intent.normalized)) return question;
  if (!/^(?:and\b|what about\b|how about\b|why\b|how so\b|tell me more\b|explain\b|yes\b|no\b)|\b(?:that|those|it|the next one|more until)\b/i.test(intent.normalized)) return question;
  let previousIndex = previousQuestions.length - 1;
  while (previousIndex >= 0 && !classifyChatQuestion(previousQuestions[previousIndex], page).topics.length) previousIndex--;
  if (previousIndex < 0) return question;
  const previous = resolveChatFollowUp(previousQuestions[previousIndex], previousQuestions.slice(0, previousIndex), page);
  const day = /\b(?:today|yesterday|\d{4}-\d{2}-\d{2})\b/.exec(intent.normalized)?.[0];
  const context = day ? previous.replace(/\b(?:today|yesterday|\d{4}-\d{2}-\d{2})\b/gi, day) : previous;
  return context + '\nFollow-up: ' + question;
}
