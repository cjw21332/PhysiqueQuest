# PhysiqueQuest admin console

A desktop/laptop dashboard at `/admin` in the existing frontend, backed by role-guarded APIs on the existing backend. Every admin API checks the `admin` role on the server; hiding the UI is not the protection.

## Pages

| Route | What it shows |
| --- | --- |
| `/admin` | KPIs (total, new and active users, completed workouts, feedback), daily trend chart, weekly retention, latest feedback, action items |
| `/admin/users` | Searchable member directory; a row opens the profile drawer (name, age, height, weight, goal, current split, earned badges) |
| `/admin/feedback` | Inbox for in-app feedback with status (new, in progress, resolved), internal notes and filters |
| `/admin/exercises` | Post-set check-ins per exercise: RPE, enjoyment, difficulty split (pain and private notes excluded) |
| `/admin/food` | Logged food entries, most logged foods, scan attempts and outcomes |
| `/admin/pose-tracker` | Rep-count agreement per exercise from manually reviewed sets, evidence entry, tracking coverage |
| `/admin/pose-tracker/references` | Reference manager (provider IDs, camera, validation status, camera test) |
| `/admin/audit` | Backend readiness and the last 100 administrator actions |

Old `/admin?view=…` links redirect to the matching page.

## Sign-in

There is one administrator login: username `admin`. The backend maps that username to the account whose email is in the API's `ADMIN_LOGIN_EMAIL` environment variable. That account must have `role: admin` and a verified email. Email sign-in is not offered on the console, and admin accounts are excluded from the member directory and member counts.

Forgot password uses the standard reset flow: enter the administrator email, receive a six-digit code (EmailJS), and set a new password (8–15 characters with an uppercase letter, a lowercase letter and a number).

Production requirements on the Render API service:

- `ADMIN_LOGIN_EMAIL` set to the administrator account's email. Without it, admin sign-in returns 401 for everyone.
- The email provider configured, as it already is for registration codes.

## Running it

- Deployed: `https://physiquequest-web.onrender.com/admin`, once the web service has the latest branch.
- Local against production data: `cd admin-dashboard; npm run dev`, then open `http://127.0.0.1:3100/admin`. This starts only the frontend, behind a loopback gateway that forwards just the dashboard routes to the Render API.

`backend/scripts/grant-verified-admin.mjs` can promote an existing verified account (dry run by default, `PQ_ADMIN_APPLY=yes` to apply).

## Data definitions

- Active users: distinct recorded sign-ins in the period. Offline use counts only after it syncs. Days are UTC.
- Feedback status defaults to `new` for older reports. Admin audit entries store pseudonymous IDs, not report contents.
- Exercise feedback groups stored workout check-ins by exercise and source.
- Food entries are saved meals; scan outcomes come from `food_scan_usage`, which has limited retention.
- Badges are computed by the activity service without changing the member's quest progress. A split appears only when a saved coach plan matches the member's current setup.
- Rep-count agreement = 1 − |counted − verified| ÷ verified reps (floored at 0) over reviewed sets. It is not form accuracy and only describes the reviewed conditions.
