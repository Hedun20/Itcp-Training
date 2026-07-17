# Google OAuth and Gmail API setup

ITCP Training uses one Google Cloud OAuth client for two separate server-side capabilities:

1. Google account sign-in.
2. Gmail API delivery of password-reset messages.

No Google secret or refresh token belongs in the Vite client. Keep every value below in the server runtime `.env` or production secret manager.

## 1. Create the Google Cloud project

1. Open Google Cloud Console and create or select the ITCP Training project.
2. Configure the OAuth consent screen with the ITCP Europe application name and support email.
3. Add the domains used by the deployed training application.
4. Enable **Google People API** and **Gmail API**.

## 2. Create the web OAuth client

Create an OAuth client of type **Web application**.

Authorized JavaScript origins:

```text
http://localhost:5173
https://YOUR-TRAINING-DOMAIN
```

Authorized redirect URIs:

```text
http://localhost:4000/api/v1/auth/google/callback
https://YOUR-TRAINING-DOMAIN/api/v1/auth/google/callback
```

The production callback must match `GOOGLE_CALLBACK_URL` exactly, including protocol and path.

## 3. Configure Google sign-in

```env
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-web-client-secret
GOOGLE_CALLBACK_URL=https://YOUR-TRAINING-DOMAIN/api/v1/auth/google/callback
```

Restart the API after changing these values. `GET /api/v1/auth/google/status` should return `enabled: true`. The Login and Register pages then activate the **Continue with Google** button automatically.

Existing users are matched by verified email and keep their stored role. A first-time Google identity chooses learner or instructor; instructor onboarding still requires the backend-only instructor code. Administrators are never created through public Google onboarding.

## 4. Authorize Gmail API delivery

Generate a long-lived refresh token for the same OAuth client with this scope:

```text
https://www.googleapis.com/auth/gmail.send
```

The Google account granting the token must be allowed to send as `GOOGLE_GMAIL_SENDER`. For a Google Workspace domain, an administrator may need to approve the OAuth application or scope.

Add the mail values:

```env
GOOGLE_GMAIL_REFRESH_TOKEN=your-server-only-refresh-token
GOOGLE_GMAIL_SENDER=training@your-domain.example
GOOGLE_GMAIL_SENDER_NAME=ITCP Training
PASSWORD_RESET_TTL_MINUTES=30
```

Restart the API. `GET /api/v1/auth/password-reset/status` should return `enabled: true`.

## 5. Production checks

1. Open the Login page and complete Google sign-in with an existing account.
2. Open `/forgot-password`, request a reset for a test administrator, and confirm delivery.
3. Use the link once and sign in with the new password.
4. Confirm the same link cannot be reused.
5. Confirm an old browser refresh session no longer restores access after the reset.
6. Never commit `.env`, client secret, or Gmail refresh token to Git.

The password recovery endpoint intentionally returns the same accepted message for existing and unknown emails. Reset tokens are stored only as SHA-256 digests, expire automatically, and are invalidated after one use.
