import { test } from '@playwright/test';

// iPhone emulation: touch, mobile viewport and Safari UA so coarse-pointer CSS applies.
test.use({ isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
import { writeFileSync, mkdirSync } from 'node:fs';
// Signed-in pages show What's New once per release; mark it seen so it never covers the controls under test.
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { sessionStorage.setItem('pq-whats-new-shown', '1'); } catch {} }); });

// Crawls every route at phone size with mocked API data and records UI defects:
// low contrast, tiny text, small touch targets, unnamed controls, horizontal overflow.
const SIGNED_OUT = ['/launch', '/login', '/register'];
const ROUTES = [
  '/verify-email', '/privacy', '/terms', '/camera-consent', '/exercises',
  '/home', '/home/notifications', '/goals', '/progress',
  '/coach', '/coach/programs', '/coach/library', '/coach/review', '/coach/session', '/coach/report',
  '/scan', '/scan/plan', '/scan/supplements', '/scan/history', '/scan/add-food',
  '/quests', '/quests/badges', '/quests/leaderboard', '/quests/personal',
  '/me', '/me/personal-data', '/me/goals', '/me/training', '/me/health', '/me/emergency-contact', '/me/personal-exercises', '/me/feedback',
];
const OUT = process.env.PQ_AUDIT_OUT || (process.env.PQ_AUDIT_EMPTY ? 'test-results/ui-audit-empty' : 'test-results/ui-audit');

async function fixtures(page, signedIn = true) {
  await page.clock.setFixedTime(new Date('2026-10-19T08:00:00Z'));
  if (signedIn) await page.addInitScript(() => localStorage.setItem('physiquequest-auth', JSON.stringify({ id: 'audit', token: 'audit-token' })));
  await page.route('**/ready', route => route.fulfill({ json: { status: 'ready' }, headers: { 'access-control-allow-origin': '*' } }));
  const profile = { name: 'Toji', email: 'toji@example.test', goal: 'Build muscle', weight: '59.5', weightUnit: 'kg', height: '172', heightUnit: 'cm', targetWeight: '74', targetDate: '2027-03-31', duration: '45 min', equipment: ['Dumbbells'], days: ['Monday', 'Wednesday', 'Friday', 'Saturday'], createdAt: '2026-10-05', photo: '', emergencyContact: { name: 'Maria Dela Cruz', phone: '+63 912 345 6789', relationship: 'Sister' } };
  const weights = Array.from({ length: 8 }, (_, i) => ({ _id: `w${i}`, metric: 'weight', unit: 'kg', value: 66.4 + i * .3, measuredAt: new Date(Date.UTC(2026, 7, 24 + i * 8)).toISOString() }));
  const exercises = Array.from({ length: 6 }, (_, i) => ({ id: `ex${i}`, name: ['Barbell bench press', 'Dumbbell shoulder press', 'Incline dumbbell fly', 'Triceps rope pushdown', 'Lateral raise', 'Push-up'][i], sets: 3, reps: '8-12', muscle: 'Chest', equipment: 'Dumbbells', tracking: 'AI tracked' }));
  await page.route('**/api/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let json = {};
    // Signed-out pass: refuse the session so /launch and /register render instead of redirecting home.
    if (!signedIn && path.includes('/auth/session')) return route.fulfill({ status: 401, json: { message: 'Unauthorized' }, headers });
    if (path.includes('/auth/session')) json = { access_token: 'audit-token', expires_in: 3600, user: { id: 'audit', name: 'Toji', email: 'toji@example.test', emailVerified: true } };
    else if (path.endsWith('/profile')) json = profile;
    else if (path.endsWith('/workouts')) json = [];
    else if (path.endsWith('/workouts/active')) json = null;
    else if (path.endsWith('/settings')) json = { values: { threshold: 30 } };
    else if (path.includes('/activity')) json = { state: { level: 7, dayStreak: 12, earnedPoints: 1840, currentExp: 600, nextLevelExp: 1000, activityDates: ['2026-10-17', '2026-10-18'] }, dailyMissions: [
      { key: 'workout', title: 'Complete one workout', progress: 0, target: 1, complete: false },
      { key: 'meals', title: 'Log 3 meals', progress: 2, target: 3, complete: false },
      { key: 'water', title: 'Drink 8 glasses of water', progress: 5, target: 8, complete: false },
    ], badges: [
      { id: 'streak-30', title: '30-day streak', icon: 'fire', earned: false, description: 'Record activity on 30 consecutive days.', progress: { current: 12, target: 30, unit: 'days' } },
      { id: 'first-pr', title: 'First PR', icon: 'trophy', earned: true, description: 'Record your first personal best.', progress: { current: 1, target: 1, unit: 'personal record' } },
    ] };
    else if (path.endsWith('/nutrition')) json = { meals: [{ id: 'meal', date: '2026-10-19', name: 'Chicken adobo with rice', mealType: 'Lunch', calories: 640, protein: 42, carbs: 70, fat: 18, time: '12:30' }], water: [{ date: '2026-10-19', glasses: 5 }] };
    else if (path.endsWith('/coach/plan')) json = { duration: '45 min', libraryReady: true, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((name, index) => ({ name, index, isWorkoutDay: index % 2 === 0, title: 'Upper Body — Push', exercises: index % 2 === 0 ? exercises : [] })) };
    else if (path.includes('/progress')) json = url.searchParams.get('metric') === 'weight' ? weights : [];
    else if (path.includes('/notifications')) json = { items: [
      { id: 'missions', icon: 'target', title: '2 missions left', body: 'Finish before midnight to keep your 12-day streak', time: '2h', unread: true, group: 'Today' },
      { id: 'report', icon: 'clipboard', title: 'Post-workout report ready', body: 'Upper Body — Push', time: '5h', unread: false, group: 'Earlier' },
    ] };
    else if (path.includes('/leaderboard')) json = { entries: Array.from({ length: 8 }, (_, i) => ({ rank: i + 1, name: ['Ana', 'Ben', 'Toji', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal'][i], points: 2400 - i * 120, isMe: i === 2 })), me: { rank: 3, points: 2160 } };
    else if (path.includes('/exercises') || path.includes('/library')) json = { items: exercises.map(e => ({ ...e, target: 'Chest', bodyPart: 'Chest', gifUrl: '' })), total: 6, page: 1, pages: 1 };
    // PQ_AUDIT_EMPTY=1: a new account with nothing logged, so every empty state renders.
    if (process.env.PQ_AUDIT_EMPTY) {
      if (path.includes('/activity')) json = { ...json, state: { ...json.state, dayStreak: 0, earnedPoints: 0, activityDates: [] }, dailyMissions: [], badges: [] };
      else if (path.endsWith('/nutrition')) json = { meals: [], water: [] };
      else if (path.endsWith('/coach/plan')) json = { ...json, days: json.days.map(day => ({ ...day, exercises: [] })) };
      else if (path.includes('/progress')) json = [];
      else if (path.includes('/notifications')) json = { items: [] };
      else if (path.includes('/leaderboard')) json = { entries: [], me: null };
      else if (path.includes('/exercises') || path.includes('/library')) json = { items: [], total: 0, page: 1, pages: 0 };
    }
    return route.fulfill({ json, headers });
  });
}

async function audit(page) {
  return page.evaluate(() => {
    const parse = c => { const m = c.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0]; return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
    const lum = ({ r, g, b }) => [r, g, b].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
    const bgOf = el => {
      const layers = [];
      for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0) layers.push(c); if (c.a >= 1) break; }
      let out = { r: 11, g: 15, b: 21 }; // page background
      for (const c of layers.reverse()) out = { r: c.r * c.a + out.r * (1 - c.a), g: c.g * c.a + out.g * (1 - c.a), b: c.b * c.a + out.b * (1 - c.a) };
      return out;
    };
    const visible = el => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && el.getBoundingClientRect().width > 0;
    const label = el => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : ''} "${(el.innerText || el.getAttribute('aria-label') || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
    const issues = { contrast: [], tinyText: [], smallTarget: [], unnamed: [], overflow: [], clipped: [], iosZoom: [] };
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el) || el.closest('nextjs-portal')) continue;
      const style = getComputedStyle(el);
      const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (hasText) {
        const size = parseFloat(style.fontSize);
        const fg = parse(style.color);
        const bg = bgOf(el);
        const blended = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
        const [hi, lo] = [lum(blended), lum(bg)].sort((a, b) => b - a);
        const ratio = (hi + .05) / (lo + .05);
        const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
        const disabled = el.closest('[disabled],[aria-disabled="true"]');
        if (!disabled && ratio < (large ? 3 : 4.5)) issues.contrast.push(`${label(el)} ${ratio.toFixed(2)}:1 ${style.color} on rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`);
        if (size < 12) issues.tinyText.push(`${label(el)} ${size}px`);
      }
      const r = el.getBoundingClientRect();
      if (r.right > innerWidth + 1 && style.position !== 'fixed' && !el.closest('[class*="scroll"],[class*="carousel"],[class*="strip"]')) issues.overflow.push(`${label(el)} right=${Math.round(r.right)}`);
      if (hasText && style.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) issues.clipped.push(label(el));
    }
    for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch], summary')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline';
      const hiddenInput = el.tagName === 'INPUT' && ['checkbox', 'radio', 'file'].includes(el.type) && (r.width < 2 || getComputedStyle(el).opacity === '0');
      if (!inline && !hiddenInput && (r.width < 44 || r.height < 44)) issues.smallTarget.push(`${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      const name = el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.innerText) || el.innerText?.trim() || el.title || el.querySelector('img[alt]')?.alt || (el.id && document.querySelector(`label[for="${el.id}"]`)?.innerText) || el.closest('label')?.innerText || el.placeholder;
      if (!name?.trim()) issues.unnamed.push(label(el));
      // iOS Safari zooms the page when a focused field's text is under 16px.
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && !hiddenInput && !['checkbox', 'radio', 'range', 'button', 'submit'].includes(el.type) && parseFloat(getComputedStyle(el).fontSize) < 16) issues.iosZoom.push(`${label(el)} ${getComputedStyle(el).fontSize}`);
    }
    if (document.documentElement.scrollWidth > innerWidth) issues.overflow.unshift(`page scrollWidth=${document.documentElement.scrollWidth}`);
    for (const k of Object.keys(issues)) issues[k] = [...new Set(issues[k])];
    // Rendered style census, compared across routes for visual consistency.
    const palette = new Set(['11,15,21', '22,29,39', '33,43,59', '39,52,68', '34,197,94', '74,222,128', '248,113,113', '248,250,252', '148,163,184', '100,116,139', '20,59,38', '72,9,9', '0,0,0', '45,212,191', '11,48,45', '251,191,36', '59,41,20', '167,139,250', '42,33,72', '56,189,248', '12,42,58', '255,255,255']);
    const census = { headings: [], pageHeading: [], buttons: [], fonts: [], offPalette: [] };
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el) || el.closest('nextjs-portal, .google-auth-mark, .badge-crest, [inert]')) continue;
      const s = getComputedStyle(el);
      if (/^H[1-3]$/.test(el.tagName)) census.headings.push(`${el.tagName} ${s.fontSize}/${s.fontWeight}`);
      if (el.matches('.pq-page-heading > h1, .pq-page-heading > h2')) census.pageHeading.push(`${s.fontSize}/${s.fontWeight} h=${Math.round(el.closest('.pq-page-heading').getBoundingClientRect().height)}`);
      if (el.matches('button.primary, button.secondary')) { const r = el.getBoundingClientRect(); census.buttons.push(`${el.classList.contains('primary') ? 'primary' : 'secondary'} h=${Math.round(r.height)} r=${s.borderRadius} ${s.fontSize}/${s.fontWeight}`); }
      census.fonts.push(s.fontFamily.split(',')[0].replace(/"/g, ''));
      for (const prop of ['color', 'backgroundColor']) {
        const c = s[prop].match(/[\d.]+/g)?.map(Number);
        if (!c || (c.length === 4 && c[3] === 0) || (prop === 'color' && ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))) continue;
        if (!palette.has(c.slice(0, 3).join(','))) census.offPalette.push(`${label(el)} ${prop}=${s[prop]}`);
      }
    }
    for (const k of Object.keys(census)) census[k] = [...new Set(census[k])];
    return { title: document.title, h1: document.querySelector('h1,h2')?.innerText, issues, census };
  });
}

// iPhone SE (1st gen), common Android (360), SE/mini, 14/15, Pro Max, tablet portrait.
for (const [width, height] of [[320, 568], [360, 800], [375, 667], [390, 844], [430, 932], [768, 1024]]) {
  test(`ui audit at ${width}px`, async ({ page, context }) => {
    test.setTimeout(900_000);
    await page.setViewportSize({ width, height });
    mkdirSync(OUT, { recursive: true });
    const report = {};
    const visit = async route => {
      await page.goto(route);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(600);
      report[route] = { url: page.url(), ...(await audit(page)) };
      const slug = route.replace(/\//g, '_') || '_root';
      await page.screenshot({ path: `${OUT}/${width}${slug}.png`, fullPage: true, animations: 'disabled' });
    };
    await fixtures(page, false);
    for (const route of SIGNED_OUT) await visit(route);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await context.clearCookies();
    await fixtures(page, true);
    for (const route of ROUTES) await visit(route);
    writeFileSync(`${OUT}/report-${width}.json`, JSON.stringify(report, null, 1));
  });
}
