# Production deployment

This configuration runs the frontend, API, Coach catalogue, private pose service and HTTPS gateway on an always-on host. Chat, food recognition, workout insights and sampled video review use the backend's server-side OpenAI integration. No Ollama service is started. The Android app needs the public HTTPS address.

Copy `.env.example` to `ai/deploy/.env` and configure the hostname, OpenAI key, private pose service key, production MongoDB connection, existing health-data encryption key, JWT secret, object storage and mail provider. Keep this file outside Git and never include secrets in the mobile app. Preserve the existing encryption key when reusing a database. Other provider credentials may still be required for existing features.

From the repository root:

```powershell
rtk proxy docker compose --env-file ai/deploy/.env -f ai/deploy/compose.yaml config --quiet
rtk proxy docker compose --env-file ai/deploy/.env -f ai/deploy/compose.yaml up -d --build
rtk proxy docker compose --env-file ai/deploy/.env -f ai/deploy/compose.yaml ps
```

Before distributing a mobile build, verify the deployed web app, `/health`, `/ready`, authenticated chat and scan, workout generation and reports, video analysis, email, storage and sign-in on a real device. Build the APK with `EXPO_PUBLIC_WEB_APP_URL` set to the stable HTTPS origin and `EXPO_PUBLIC_API_URL` set to that origin plus `/api`. These are public configuration; the OpenAI key must stay on the backend.

The shared AI request limits default to 30 per user per hour and 500 across the service per UTC day. They are request limits, not a hard dollar cap. Configure OpenAI project spending controls separately. `store: false` does not change OpenAI project data-sharing settings.
