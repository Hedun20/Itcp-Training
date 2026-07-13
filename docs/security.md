# Security notes

## Authentication

- Passwords are validated against the registration policy and hashed with bcrypt before storage. Email addresses are normalized separately.
- Public registration always creates an active learner. It never accepts a role field.
- Access JWTs are intentionally short-lived and remain in memory on the client.
- Refresh credentials are signed JWTs that rotate on every use; only their SHA-256 digests and revocation metadata are stored in MongoDB.
- Refresh cookies are HTTP-only and use environment-appropriate `Secure` and `SameSite` settings.
- Authentication endpoints have a dedicated rate limit. JSON and form request bodies also have explicit size limits.
- Google OAuth routes are exposed only when all required credentials are configured. The client presents a controlled unavailable state otherwise.
- The administrator seed refuses to promote an existing learner that happens to own `ADMIN_EMAIL`. An explicit rerun for an existing administrator rotates that administrator's password to `ADMIN_PASSWORD`.

## Authorization and privacy

- Admin routes require both a verified access token and the `admin` role.
- Self-registered users cannot select or promote their own role.
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
- Media deletion requires an administrator and verifies the database asset before removing a file.
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

Leave `COOKIE_SECURE` blank to use the safe automatic default: disabled for plain-HTTP development and enabled when `NODE_ENV=production`. Any explicit value must be exactly `true` or `false`; production deployments should use `true` with TLS.
