# Backend

This folder is reserved for the future PhysiqueQuest API and authentication service. MongoDB Atlas is the selected database, but no Atlas environment, backend server, or database connection exists yet. The current frontend remains usable on its own and stores some data in local storage on the current browser/device.

Follow [the database and backend rules](../.agents/rules/DATABASE.md) before adding persistence, APIs, or services. They define the static-to-Atlas transition, data ownership, security, MongoDB modeling, and language-independent backend practices.

## Suggested next steps

1. Choose an API runtime based on the deployment environment and prepare isolated Atlas development/staging environments and server-only credentials.
2. Add authenticated profile and onboarding endpoints.
3. Move health and emergency-contact data to protected server storage with clear consent and retention rules.
4. Replace the frontend's local profile store with an API adapter in `frontend/lib/profile-storage.ts`.

No backend server is required to run the current prototype.
