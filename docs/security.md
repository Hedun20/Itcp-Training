# Security notes

## Authentication

- Passwords are validated against the registration policy and hashed with bcrypt before storage. Email addresses are normalized separately.
- Public registration accepts only `learner` or `instructor`; attempts to create `admin` are rejected by strict request validation.
- Learners need no registration code. Instructor registration requires an enabled backend feature and an exactly six-digit server-side secret. Comparison uses constant-time comparison after length validation where practical.
- Instructor-code failures are rate limited independently by client IP and normalized email. Successful instructor registrations are audit logged without the submitted or configured code.
- Access JWTs are intentionally short-lived and remain in memory on the client.
- Refresh credentials are signed JWTs that rotate on every use; only their SHA-256 digests and revocation metadata are stored in MongoDB.
- Refresh cookies are HTTP-only and use environment-appropriate `Secure` and `SameSite` settings.
- Login and account-creation endpoints have dedicated environment-aware limits. Development allows normal manual testing while production uses tighter limits; `/auth/me` and `/auth/google/status` never consume login attempts. JSON and form request bodies also have explicit size limits.
- Google OAuth routes are exposed only when all required credentials are configured. A new verified identity receives a short-lived, signed HTTP-only onboarding cookie and then chooses learner or instructor. Existing users bypass onboarding and retain their database role.
- The administrator seed refuses to promote an existing learner that happens to own `ADMIN_EMAIL`. An explicit rerun for an existing administrator rotates that administrator's password to `ADMIN_PASSWORD`.

## Authorization and privacy

- Admin routes require both a verified access token and the `admin` role.
- Instructor access is separate from administration: instructors can create courses, edit only courses they own, manage their own media, and read learner progress/results only for their owned courses.
- Instructors cannot assign roles, manage administrators, edit another instructor's course, read global audit records, or access `/admin/*` settings and reports.
- `Course.createdBy` is the authoritative ownership field. Ownership is checked by the API and never inferred from hidden client navigation.
- Learner progress and attempts are scoped from the authenticated user identifier, never from a user identifier supplied in the URL or request body.
- Admin-only exports are protected at the API boundary.
- Draft and archived courses are omitted from learner reads.
- Correct assessment answers are removed from learner course responses and scoring is performed by the API.

## Input and output handling

- Zod request schemas reject unexpected or malformed values at API boundaries.
- React renders course text as text; the application does not inject author-managed HTML.
- JSON body size and CORS origins are constrained by configuration.
- Security headers are provided by Helmet.
- API errors have a consistent public shape and do not disclose stacks in production.

## Uploads

- Only explicit image MIME types and matching filename extensions are accepted.
- Storage names are collision-safe and are never based on a user-controlled path.
- Maximum size is controlled by `UPLOAD_MAX_BYTES`.
- Media deletion requires an administrator or the instructor who uploaded the asset and verifies the database asset before removing a file.
- Uploaded files are runtime data and are not committed.

## Production checklist

1. Generate unique, high-entropy access and refresh secrets.
2. Use TLS and set production cookie options.
3. Restrict `CLIENT_URL` to the deployed client origin.
4. Use a least-privileged MongoDB account and enable backups.
5. Place the API behind a trusted reverse proxy and configure proxy handling deliberately.
6. Persist or replace the uploads volume; do not rely on an ephemeral container filesystem.
7. Use a unique, high-entropy `ADMIN_PASSWORD` for provisioning and remove seed-only administrator values from the long-running API environment afterward. An intentional seed rerun rotates the existing administrator to the configured password.
8. Configure Google OAuth redirect URIs exactly if that provider is enabled.
9. Store `INSTRUCTOR_REGISTRATION_CODE` only in the backend secret environment. Never create a `VITE_` variant, return it from an API, log request bodies, or publish environment files/source maps containing its value.
10. Keep `INSTRUCTOR_CODE_MAX_ATTEMPTS` and `INSTRUCTOR_CODE_WINDOW_MINUTES` at strict production values and configure `TRUST_PROXY` to match the real proxy chain so IP limits cannot be bypassed through spoofed forwarding headers.

Leave `COOKIE_SECURE` blank to use the safe automatic default: disabled for plain-HTTP development and enabled when `NODE_ENV=production`. Any explicit value must be exactly `true` or `false`; production deployments should use `true` with TLS.
