# Backend

This folder is reserved for the future PhysiqueQuest API, data store, and authentication service. The current frontend is deliberately usable on its own and stores a profile in the browser's local storage on the current device.

## Suggested next steps

1. Choose an API runtime and database based on the deployment environment.
2. Add authenticated profile and onboarding endpoints.
3. Move health and emergency-contact data to protected server storage with clear consent and retention rules.
4. Replace the frontend's local profile store with an API adapter in `frontend/lib/profile-storage.ts`.

No backend server is required to run the current prototype.
