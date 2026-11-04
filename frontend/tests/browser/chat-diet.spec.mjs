import { createRequire } from 'node:module';
import { test, expect } from '@playwright/test';

const backendRequire = createRequire(new URL('../../../backend/package.json', import.meta.url));
backendRequire('reflect-metadata');
const { ChatService } = await import('../../../backend/dist/chat/chat.service.js');
const { ChatContextService } = await import('../../../backend/dist/chat/chat-context.service.js');

const OWNER = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const NO_SCOPE_REFUSAL = /Please ask about something in PhysiqueQuest/i;
const headers = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};
const workoutPlan = {
  goal: 'Strength', weekLabel: 'Synthetic week', sessionCount: 1,
  duration: '30 min', sets: '3 × 10', libraryReady: true,
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((name, index) => ({
    name, label: name.slice(0, 3), index, isWorkoutDay: index === 0,
    title: index === 0 ? 'Upper body' : 'Recovery day', focus: index === 0 ? 'Upper body' : null,
    exercises: index === 0 ? [{ exerciseId: 'push-up', name: 'Push-up', group: 'Chest', targetMuscle: 'Chest', equipment: 'Bodyweight', tracking: 'Manual', prescription: '3 × 10' }] : [],
  })),
};

/**
 * Real browser -> real compiled production chat/context -> synthetic owned rows.
 * Authentication transport and unrelated page APIs are fixtures. No live MongoDB,
 * user data, provider credentials or model generation is involved.
 */
async function fixture(page, { plan = { goal: 'Maintenance', calories: 2000, protein: 30, carbs: 40, fat: 30 }, pathname = '/scan', program = null, semanticPlan, semanticError = false } = {}) {
  const state = { plan, program, requests: [], reads: [], generations: 0, semanticCalls: 0 };
  const model = (name, value) => ({ collection: {
    findOne: async filter => {
      state.reads.push({ name, owner: String(filter.userId) });
      return String(filter.userId) === OWNER ? (typeof value === 'function' ? value() : value) : null;
    },
    find: filter => {
      state.reads.push({ name, owner: String(filter.userId) });
      const cursor = { sort: () => cursor, limit: () => cursor, toArray: async () => [] };
      return cursor;
    },
  } });
  const context = new ChatContextService(
    model('profile', { goal: 'Build muscle', weight: '72', weightUnit: 'kg' }),
    model('nutrition', () => ({ meals: [], water: [], dietaryPlan: state.plan, healthNotes: 'PRIVATE-SENTINEL' })),
    model('workouts', null), model('activity', null), model('programs', () => state.program ? { plan: state.program, createdAt: new Date() } : null),
    model('progress', null), model('settings', null),
    { getForAssistant: async () => ({ state: {}, dailyMissions: [], badges: [] }) },
  );
  const chat = new ChatService(context, {
    ...(semanticPlan || semanticError ? { routeQuestion: async () => { state.semanticCalls++; if (semanticError) throw new Error('PRIVATE-SEMANTIC-RUNTIME-ERROR'); return semanticPlan; } } : {}),
    generate: async () => {
      state.generations++;
      throw new Error('This factual diet-plan request must not require generation');
    },
  });

  await page.context().addInitScript(({ owner }) => {
    localStorage.setItem('physiquequest-auth', JSON.stringify({ id: owner, token: 'synthetic-access' }));
  }, { owner: OWNER });
  await page.context().route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path.endsWith('/chat')) {
      const body = request.postDataJSON();
      state.requests.push(body);
      try {
        const json = await chat.reply(OWNER, body.messages, body.includePersonalData, body.page);
        return route.fulfill({ headers, json });
      } catch (error) {
        return route.fulfill({ headers, status: error.getStatus?.() || 503, json: { message: 'Synthetic chat test request failed' } });
      }
    }
    let json = {};
    if (/\/auth\/session\/(?:migrate|refresh)$/.test(path)) json = { access_token: 'synthetic-access', expires_in: 3600, user: { id: OWNER, name: 'Synthetic user', email: 'synthetic@example.invalid', emailVerified: true } };
    else if (path.endsWith('/profile')) json = { name: 'Synthetic user', equipment: ['Dumbbells'], days: ['Monday'], duration: '30 min', goal: 'Build muscle', weight: '72', weightUnit: 'kg' };
    else if (path.endsWith('/nutrition')) json = { meals: [], water: [], dietaryPlan: state.plan };
    else if (path.endsWith('/settings')) json = { values: { threshold: 30 } };
    else if (path.endsWith('/coach/plan')) json = state.program || { days: [], libraryReady: true };
    else if (path.endsWith('/auth/me')) json = { role: 'user' };
    else if (path.endsWith('/workouts/active')) json = null;
    else if (path.endsWith('/progress') || path.endsWith('/workouts')) json = [];
    return route.fulfill({ headers, json });
  });
  await page.goto(pathname);
  await page.getByRole('button', { name: 'Open Phiq coach' }).click();
  return { state, dialog: page.getByRole('dialog', { name: 'Phiq' }) };
}

async function ask(dialog, question) {
  const replies = dialog.locator('.coach-chat-message.assistant p');
  const previousCount = await replies.count();
  await dialog.getByLabel('Ask Phiq about PhysiqueQuest').fill(question);
  await dialog.getByRole('button', { name: 'Send message' }).click();
  await expect(replies).toHaveCount(previousCount + 1);
  const reply = replies.last();
  await expect(reply).toBeVisible();
  await expect(dialog.getByLabel('Ask Phiq about PhysiqueQuest')).toBeEnabled();
  return reply;
}

test('reported current diet question asks consent, then returns the actual saved plan', async ({ page }) => {
  const { dialog, state } = await fixture(page);
  const question = "what's my current diet plan?";
  const optOut = await ask(dialog, question);
  await expect(optOut).toContainText(/enable|turn on|permission/i);
  await expect(optOut).not.toContainText(NO_SCOPE_REFUSAL);
  await expect(optOut).not.toContainText('2000');
  expect(state.reads).toHaveLength(0);

  await dialog.getByRole('checkbox', { name: 'Use my saved fitness data' }).check();
  const answer = await ask(dialog, question);
  await expect(answer).toContainText(/Maintenance/i);
  await expect(answer).toContainText(/2,?000/);
  await expect(answer).toContainText(/30/);
  await expect(answer).toContainText(/40/);
  await expect(answer).not.toContainText(NO_SCOPE_REFUSAL);
  await expect(answer).not.toContainText(/Sources:|Your recent saved nutrition|PRIVATE-SENTINEL/);
  await expect(dialog.getByRole('list', { name: 'Reply sources' })).toHaveCount(0);
  expect(state.requests.at(-1)).toMatchObject({ includePersonalData: true, page: '/scan' });
  expect(state.reads.some(read => read.name === 'nutrition')).toBe(true);
  expect(state.reads.every(read => read.owner === OWNER)).toBe(true);
  expect(state.generations).toBe(0);
});

test('unfamiliar wording uses semantic routing, asks consent, then displays the saved value', async ({ page }) => {
  const { dialog, state } = await fixture(page, { semanticPlan: { decision: 'answer', routeIds: ['nutrition.calorie-target'], timeframe: 'unspecified' } });
  const question = 'What daily energy allowance did I choose?';
  await expect(await ask(dialog, question)).toContainText(/Enable.*saved fitness data/i);
  expect(state.reads).toHaveLength(0);
  await dialog.getByRole('checkbox', { name: 'Use my saved fitness data' }).check();
  const answer = await ask(dialog, question);
  await expect(answer).toContainText(/2000 kcal/);
  await expect(answer).not.toContainText(NO_SCOPE_REFUSAL);
  expect(state.semanticCalls).toBe(2);
  expect(state.generations).toBe(0);
});

test('an unavailable meaning resolver asks clarification and still accepts a precise record question', async ({ page }) => {
  const { dialog, state } = await fixture(page, { semanticError: true });
  await dialog.getByRole('checkbox', { name: 'Use my saved fitness data' }).check();
  const unclear = await ask(dialog, 'What daily energy allowance did I choose?');
  await expect(unclear).toContainText(/clarify|rephrase/i);
  await expect(unclear).not.toContainText(/PRIVATE|Please ask about something in PhysiqueQuest/);
  expect(state.reads).toHaveLength(0);
  await expect(await ask(dialog, 'What is my daily calorie target?')).toContainText(/2000 kcal/);
  expect(state.semanticCalls).toBe(1);
  expect(state.generations).toBe(0);
});

for (const question of [
  'what’s my current diet plan?',
  'Show me my nutrition plan',
  'What is my current dietary plan?',
]) {
  test(`saved diet answer survives natural wording: ${question}`, async ({ page }) => {
    const { dialog, state } = await fixture(page);
    await dialog.getByRole('checkbox', { name: 'Use my saved fitness data' }).check();
    const answer = await ask(dialog, question);
    await expect(answer).toContainText(/2,?000/);
    await expect(answer).toContainText(/Maintenance/i);
    await expect(answer).not.toContainText(NO_SCOPE_REFUSAL);
    expect(state.generations).toBe(0);
  });
}

test('missing current diet plan is explained without inventing a plan or rejecting the topic', async ({ page }) => {
  const { dialog, state } = await fixture(page, { plan: null });
  await dialog.getByRole('checkbox', { name: 'Use my saved fitness data' }).check();
  const answer = await ask(dialog, "what's my current diet plan?");
  await expect(answer).toContainText(/no|not|missing|unavailable|haven.t|hasn.t/i);
  await expect(answer).toContainText(/diet|plan|Scan/i);
  await expect(answer).not.toContainText(/2,?000|Maintenance/);
  await expect(answer).not.toContainText(NO_SCOPE_REFUSAL);
  expect(state.generations).toBe(0);
});

test('diet follow-up uses the saved calorie and protein targets in the same conversation', async ({ page }) => {
  const { dialog, state } = await fixture(page);
  await dialog.getByRole('checkbox', { name: 'Use my saved fitness data' }).check();
  await expect(await ask(dialog, "what's my current diet plan?")).toContainText(/2,?000/);
  const answer = await ask(dialog, 'What are my daily calorie and protein targets?');
  await expect(answer).toContainText(/2,?000/);
  await expect(answer).toContainText(/150\s*g/i);
  await expect(answer).not.toContainText(NO_SCOPE_REFUSAL);
  await expect(answer).not.toContainText(/Sources:|PRIVATE-SENTINEL/);
  expect(state.requests.at(-1).messages.filter(message => message.role === 'user').map(message => message.text)).toEqual([
    "what's my current diet plan?", 'What are my daily calorie and protein targets?',
  ]);
  expect(state.generations).toBe(0);
});

for (const pathname of ['/scan', '/scan/plan']) {
  test(`short diet follow-ups keep personal context on ${pathname}`, async ({ page }) => {
    const { dialog, state } = await fixture(page, { pathname });
    await dialog.getByRole('checkbox', { name: 'Use my saved fitness data' }).check();
    await expect(await ask(dialog, "what's my current diet plan?")).toContainText(/2,?000/);
    await expect(await ask(dialog, 'What about calories?')).toContainText(/2,?000/);
    const protein = await ask(dialog, 'And protein?');
    await expect(protein).toContainText(/150\s*g/);
    await expect(protein).not.toContainText(/Sources:|Open \/scan/);
    expect(state.generations).toBe(0);
    expect(state.reads.every(read => read.owner === OWNER)).toBe(true);
  });
}

test('keeps consent and chat controls usable on narrow mobile and desktop layouts', async ({ page }) => {
  const { dialog } = await fixture(page);
  const consent = dialog.getByRole('checkbox', { name: 'Use my saved fitness data' });
  const dock = dialog.locator('.coach-chat-dock');
  const composer = dialog.getByLabel('Ask Phiq about PhysiqueQuest');
  const disclosure = dialog.getByText('What can Phiq access?');

  await page.setViewportSize({ width: 320, height: 720 });
  await expect(consent).toBeVisible();
  await expect(composer).toBeVisible();
  let modalBox = await dialog.boundingBox();
  let dockBox = await dock.boundingBox();
  let composerBox = await composer.boundingBox();
  expect(modalBox).not.toBeNull();
  expect(dockBox).not.toBeNull();
  expect(composerBox).not.toBeNull();
  expect(modalBox.x).toBeGreaterThanOrEqual(0);
  expect(modalBox.x + modalBox.width).toBeLessThanOrEqual(320);
  expect(modalBox.width).toBe(320);
  expect(modalBox.height).toBeCloseTo(720 * 0.8, 0);
  expect(modalBox.y).toBeCloseTo(720 * 0.2, 0);
  expect(dockBox.y).toBeLessThan(composerBox.y);
  expect(composerBox.y + composerBox.height).toBeLessThanOrEqual(720);

  await disclosure.click();
  await expect(dialog.locator('.coach-chat-access-details p')).toContainText(/health profile and emergency contact/i);
  await expect(dialog.locator('.coach-chat-access-details p')).toContainText(/other accounts/i);
  await consent.check();
  await expect(dialog.locator('.coach-chat-access-state')).toHaveText('On');

  await page.setViewportSize({ width: 720, height: 900 });
  modalBox = await dialog.boundingBox();
  expect(modalBox.width).toBe(720);
  expect(modalBox.x).toBe(0);
  expect(modalBox.height).toBeCloseTo(900 * 0.8, 0);
  expect(modalBox.y).toBeCloseTo(900 * 0.2, 0);

  await page.setViewportSize({ width: 1280, height: 900 });
  modalBox = await dialog.boundingBox();
  expect(modalBox.width).toBe(440);
  expect(modalBox.x + modalBox.width).toBeCloseTo((1280 + 480) / 2 - 16, 0);
  expect(modalBox.y + modalBox.height).toBeCloseTo(900 - 16, 0);
});

for (const pathname of ['/scan', '/coach']) {
  test(`ambiguous current plan follows the actual section context on ${pathname}`, async ({ page }) => {
    const { dialog, state } = await fixture(page, { pathname, program: workoutPlan });
    await dialog.getByRole('checkbox', { name: 'Use my saved fitness data' }).check();
    const answer = await ask(dialog, 'What is my current plan?');
    if (pathname === '/scan') {
      await expect(answer).toContainText(/Maintenance/i);
      await expect(answer).toContainText(/2,?000/);
      await expect(answer).not.toContainText(/Strength|Upper body|Push-up/);
    } else {
      await expect(answer).toContainText(/Strength|Monday|Upper body|Push-up/);
      await expect(answer).not.toContainText(/Maintenance|2,?000/);
    }
    await expect(answer).not.toContainText(NO_SCOPE_REFUSAL);
    await expect(answer).not.toContainText(/Sources:|PRIVATE-SENTINEL/);
    expect(state.requests.at(-1).page).toBe(pathname);
    expect(state.reads.every(read => read.owner === OWNER)).toBe(true);
    expect(state.generations).toBe(0);
  });
}
