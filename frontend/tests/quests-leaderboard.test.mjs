import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('quests screen opens a period-switchable leaderboard with an account ranking', async () => {
  const screen = await source('sections/Quests Section/QuestSection.tsx');
  assert.match(screen, /setScreen\('leaderboard'\)/);
  assert.match(screen, /This week/);
  assert.match(screen, /This month/);
  assert.match(screen, /All time/);
  assert.match(screen, /aria-pressed/);
  assert.match(screen, /showLeaderboard/);
  assert.match(screen, /profile\.name/);
  assert.match(screen, /BottomNav/);
});

test('leaderboard layout adapts its ranked list and podium to narrow screens', async () => {
  const styles = await source('app/globals.css');
  assert.match(styles, /\.leaderboard-scroll/);
  assert.match(styles, /\.leaderboard-podium/);
  assert.match(styles, /@media\s*\(max-width:\s*390px\)/);
});

test('leaderboard is fed by the ranking API instead of sample data', async () => {
  const screen = await source('sections/Quests Section/QuestSection.tsx');
  assert.match(screen, /useLeaderboard/);
  assert.match(screen, /leaderboard\?\.entries/);
  assert.match(screen, /leaderboard\.self/);
  assert.match(screen, /leaderboardError/);
  assert.doesNotMatch(screen, /Sample rankings shown for preview/);
  const client = await source('lib/api.ts');
  assert.match(client, /getLeaderboard\(period/);
});
