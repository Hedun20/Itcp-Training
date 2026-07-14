# ITCP Training

ITCP Training is the full-stack learning platform for ITCP Europe. It provides a branded learner journey, an ownership-scoped instructor CMS, secure administration, server-scored assessments, persistent progress, local image management, audit records, and role-based authentication.

## What is included

- React 18, Vite, React Router, and an accessible light/dark ITCP design system.
- TypeScript, Express, Mongoose, Zod, JWT authentication, rotating HTTP-only refresh cookies, and bcrypt password hashing.
- Learner catalog, course player, resume support, assessment results, progress, attempt history, and profile.
- Instructor self-registration behind a server-only six-digit access code, plus owned-course authoring, media, learner progress, and result views.
- Admin course, module, structured-block, assessment, media, user, progress, and result management with CSV export.
- Idempotent migration of DCT-01, DCT-02, HSE-01, and ACS-01 from the original prototype.
- Optional Google OAuth that remains safely unavailable until all credentials are configured.
- Focused frontend and backend tests rather than snapshot-heavy coverage.

## Repository structure

```text
ITCP-Training/
├── client/                 React/Vite application
│   └── src/branding/       Theme, reusable components, and shells
├── server/                 Express/TypeScript API
│   ├── src/models/         MongoDB models
│   ├── src/routes/         Versioned API route handlers
│   ├── src/services/       Auth, courses, progress, scoring, and media logic
│   ├── src/seeds/          Idempotent courses and administrator seed
│   └── uploads/            Git-ignored runtime image storage
├── docs/                   Architecture, security, operations, and migration notes
├── .env.example
└── package.json            npm-workspace scripts
```

## Prerequisites

- Node.js 20 or newer.
- npm 10 or newer.
- A local or remote MongoDB connection.

MongoDB is intentionally not embedded in the production runtime. On Windows PowerShell systems that block `npm.ps1`, use `npm.cmd` as shown below.

## Local setup

```powershell
Set-Location C:\Dev\ITCP-Training
Copy-Item .env.example .env
npm.cmd install
```

Edit `.env` before running the application:

- replace `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` with different high-entropy values;
- point `MONGODB_URI` at an available database;
- set a strong `ADMIN_PASSWORD` and a real administrator email;
- leave all three Google variables blank unless the provider is configured.
- the example enables instructor registration, but the endpoint remains unavailable until a six-digit `INSTRUCTOR_REGISTRATION_CODE` is supplied through the backend runtime or secret manager; disable it in environments where self-registration is not intended.

Seed the four migrated courses and the first administrator, then start both applications:

```powershell
npm.cmd run seed
npm.cmd run seed:repair-content
npm.cmd run content:verify
npm.cmd run dev
```

`npm.cmd run seed` provisions or refreshes the configured administrator, then inserts any missing canonical courses. Use `npm.cmd run seed:repair-content` to restore missing canonical modules, blocks, images, questions, and answer options at their original positions without replacing matching administrator-edited items. Use `npm.cmd run seed:admin` only when intentionally provisioning or rotating that administrator without running the course seed.

The client defaults to [http://localhost:5173](http://localhost:5173), and the API health endpoint defaults to [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health).

## Workspace commands

```powershell
npm.cmd run dev             # client and server together
npm.cmd run dev:client      # Vite only
npm.cmd run dev:server      # Express API only
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run seed
npm.cmd run seed:admin
npm.cmd run seed:repair-content
npm.cmd run content:verify
npm.cmd run content:verify-source
```

## Authentication notes

Access tokens are kept in client memory and are never written to localStorage. The longer-lived refresh credential is an HTTP-only cookie; the API rotates it whenever it is used and stores only its digest. Public registration accepts only learner or instructor. Learners need no access code; instructors must supply the configured six-digit code, which is checked only by the API with independent IP and normalized-email attempt limits. Administrator creation remains limited to the secure seed or an authenticated administrator role change.

Google sign-in is optional. Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` together and add that exact callback to the Google OAuth client. A first-time verified Google identity selects learner or instructor after OAuth; instructor selection uses the same backend-only code policy. An existing Google-linked or same-email account signs in with its stored role and cannot use onboarding to change it. With any or all Google values absent, the provider stays disabled without affecting email/password login.

## Production

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

Serve `client/dist` through a static host and run `server/dist/server.js` as the API process. Use TLS, a restricted MongoDB account, a persistent uploads volume, a production secret manager, and the exact deployed `CLIENT_URL`. Uploaded runtime files and `.env` are ignored by Git.

`VITE_*` values are embedded when the client is built. The instructor registration code must never use a `VITE_` name; it belongs only in the backend environment. The example keeps `VITE_API_URL=/api/v1`, which is safe for local development and a same-origin production reverse proxy. In that deployment, route both `/api/v1` and `/uploads` to the Express service. For a deliberately split client/API deployment, set `VITE_API_URL=https://api.example.com/api/v1` (and `VITE_MEDIA_ORIGIN` if media uses another origin) in the build environment before `npm.cmd run build`; never ship the example localhost URL.

Because the client uses `BrowserRouter`, the static host must fall back to `client/dist/index.html` for non-file application routes. Do not apply that fallback to `/api/v1`, `/uploads`, or real static assets.

## Documentation

- [Architecture](docs/architecture.md)
- [Security notes](docs/security.md)
- [Operations](docs/operations.md)
- [Course migration](docs/content-migration.md)
- [Brand system](docs/brand-system.md)
- [API reference](docs/api.md)

The normal seed is non-destructive for existing seeded course codes. `npm.cmd run seed:repair-content` is the safe repair path when canonical content is incomplete: it adds missing stable items in canonical order, repairs partially deleted answer options, preserves administrator-replaced images, and reports inserted, updated, and skipped work. Set `SEED_UPDATE_EXISTING=true` only when intentionally replacing CMS changes with the canonical migrated content.
