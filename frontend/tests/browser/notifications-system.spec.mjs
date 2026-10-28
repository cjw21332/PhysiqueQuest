import { test, expect } from '@playwright/test';

test('notifications show account data, mark read, and persist reminder settings', async ({ page }) => {
  let state = { items: [{ id: 'one', icon: 'clipboard', title: 'Workout completed', subtitle: '', body: 'Saved', time: 'now', group: 'Today', unread: true }], reminder: null };
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let result = {};
    if (path.includes('/auth/session/')) result = { user: { id: 'notification-test', name: 'Test', email: 'test@example.test' }, access_token: 'test-token', expires_in: 3600 };
    else if (path.endsWith('/profile')) result = { name: 'Test', goal: 'Maintain', duration: '45 min', equipment: [] };
    else if (path.endsWith('/nutrition')) result = { meals: [], water: [] };
    else if (path.endsWith('/activity/state')) result = { state: { level: 1, currentExp: 0, nextLevelExp: 100 }, dailyMissions: [], badges: [] };
    else if (path.endsWith('/coach/plan')) result = { days: [], libraryReady: false };
    else if (path.endsWith('/notifications/reminder')) { state = { ...state, reminder: request.postDataJSON() }; result = state; }
    else if (path.endsWith('/notifications/one/read')) { state = { ...state, items: state.items.map(item => ({ ...item, unread: false })) }; result = state; }
    else if (path.endsWith('/notifications')) result = state;
    return route.fulfill({ json: result, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  });
  await page.goto('/home/notifications');
  await expect(page.getByRole('button', { name: 'Workout completed, unread' })).toBeVisible();
  await page.getByRole('button', { name: 'Workout completed, unread' }).click();
  await expect(page.getByRole('button', { name: 'Workout completed', exact: true })).toBeVisible();
  await page.getByLabel('Daily check-in reminder').fill('19:30');
  await page.getByRole('button', { name: 'Save reminder' }).click();
  await expect(page.getByText('Daily reminder saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Daily check-in reminder')).toHaveValue('19:30');
  await expect(page.getByRole('button', { name: 'Workout completed', exact: true })).toBeVisible();
});
