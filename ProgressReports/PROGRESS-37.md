# Quests and account dark references

Applied the supplied dark presentation to Quests, Leaderboard, Account & settings, Personal data, Goals, Training preference, Health profile and Emergency contact. Reused existing components and the bundled Inter font. Changes are limited to route theme selection, scoped CSS, tests and documentation.

Preserved API data, profile/settings writes, Back/Discard/Save, leaderboard periods/privacy, and alarm behavior. Did not introduce screenshot-only penalty/freeze rules or misleading maximum-volume claims. The app remains dark by default.

Validation: production build and focused browser checks covering the five editor routes, discard/save state, leaderboard navigation and narrow width. Reviewed mobile screenshots and corrected inherited light text and editor spacing. Mocked API evidence does not establish live persistence or physical-device behavior.
