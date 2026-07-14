# Local and production operations

## Local prerequisites

- Node.js 20 or newer and npm 10 or newer.
- MongoDB running locally, or a reachable MongoDB Atlas/development cluster.

This Windows workstation blocks PowerShell's `npm.ps1`; use `npm.cmd` in PowerShell commands.

## First run

```powershell
Set-Location C:\Dev\ITCP-Training
Copy-Item .env.example .env
npm.cmd install
npm.cmd run seed
npm.cmd run dev
```

Before seeding, replace both JWT example secrets and the administrator password in `.env`. The default local URLs are `http://localhost:5173` for the client and `http://localhost:4000/api/v1/health` for the API health check.

The main seed provisions or refreshes the configured administrator before processing courses. Run `npm.cmd run seed:admin` separately only when the administrator must be provisioned or rotated without processing course content.

The default seed preserves existing CMS edits for the four canonical course codes. Set `SEED_UPDATE_EXISTING=true` only for an intentional canonical-content refresh; that mode can replace edited modules, assessment content, and publication state.

When existing course documents are incomplete, use the non-destructive repair and verify it before starting the application:

```powershell
npm.cmd run seed:repair-content
npm.cmd run content:verify
```

`content:verify-source` checks the structured seed against the authoritative semantic manifest. Pass a temporary extracted `trainings.mjs` path as its final argument when independently auditing the ZIP export; never extract the archive over this repository and never search `node_modules` for source content.

## Validation

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

The backend tests use an isolated test database/runtime and must never point at a shared development or production database.

## Production build

```powershell
npm.cmd ci
npm.cmd run build
```

Deploy the generated client assets from `client/dist` and run the compiled API from `server/dist`. Supply the documented environment variables through the host's secret manager rather than an image or repository file. The API process requires a writable, persistent uploads directory until an object-storage adapter is introduced.

Vite reads the repository-level environment at build time and embeds every `VITE_*` value. Keep `VITE_API_URL=/api/v1` when a same-origin reverse proxy sends `/api/v1` and `/uploads` to Express. For separate origins, set the deployed HTTPS API URL—and optional media origin—in the build environment before building the client. Changing those variables after the build does not rewrite the generated JavaScript.

`INSTRUCTOR_REGISTRATION_CODE` is a backend-only secret and must never have a `VITE_` prefix. Set `INSTRUCTOR_REGISTRATION_ENABLED=true` only when a six-digit code has been placed in the backend secret manager. The attempt count/window settings apply independently to client IP and normalized email; configure `TRUST_PROXY` to the exact production proxy depth.

Rate-limit counters use the API process's in-memory store. This protects a single production API process; before running multiple API replicas, configure a shared rate-limit store so every replica enforces the same attempt window.

The client uses `BrowserRouter`. Configure the static host to serve `client/dist/index.html` as the fallback for application routes such as `/courses/...`, `/history`, `/auth/callback`, `/instructor/...`, and `/admin/...`. Keep real asset files, `/api/v1`, and `/uploads` ahead of that fallback so they are never rewritten to HTML.

## Google OAuth

Create a web OAuth client with the deployed API callback URI, then set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL`. Leave all three blank to disable Google sign-in cleanly. The application remains fully functional with email/password authentication when Google OAuth is disabled.

## Backup and recovery

Back up MongoDB and the uploads volume together. Course documents refer to MediaAsset URLs, so restoring only the database can leave missing local files. Audit logs should be retained according to ITCP Europe's operational policy.
