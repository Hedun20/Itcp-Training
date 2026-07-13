# API reference

The default base URL is `http://localhost:4000/api/v1`. JSON endpoints use the shared error envelope below and return their primary result under `data`. Named aliases such as `user`, `course`, or `progress` are also present where useful to clients.

## Authentication

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public, rate limited | Register a learner with `name`, `email`, and `password`. |
| `POST` | `/auth/login` | Public, rate limited | Authenticate email/password and issue an access token plus refresh cookie. |
| `POST` | `/auth/refresh` | Refresh cookie, rate limited | Rotate the refresh token and issue a new access token. |
| `POST` | `/auth/logout` | Refresh cookie, rate limited | Revoke the active refresh record and clear the cookie. |
| `GET` | `/auth/me` | Access token | Return the current user. |
| `GET` | `/auth/google/status` | Public | Report whether the optional provider is configured. |
| `GET` | `/auth/google` | Public | Start Google OAuth, or return a controlled `503` when unavailable. |
| `GET` | `/auth/google/callback` | Google/state cookie | Complete OAuth, issue the refresh cookie, and redirect to the client callback. |

Registration ignores any attempted role field; every public account is a learner. The access token is sent as `Authorization: Bearer <token>`. The refresh token is not returned in JSON.

If two same-client refresh requests race, the losing request can return `409 REFRESH_RACE_RETRY` with `details.retryable=true` and a short `retryAfterMs`. It does not clear the cookie or revoke the winning token family. Older or mismatched reuse remains a `401` and revokes the family.

## Users

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/users/me` | Current user | Read the current profile. |
| `PATCH` | `/users/me` | Current user | Update the current user's display name. |
| `GET` | `/users` | Admin | List users. |
| `PATCH` | `/users/:id` | Admin | Change an existing user's current role or status. |

The API prevents an administrator from demoting or suspending their own active session. Role and status changes produce audit records.

## Courses

All course routes require an access token. Learners see only published courses; administrators can see every status and receive the answer fields required by the editor.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/courses` | User | List visible courses; supports `search`, `status` for admins, `page`, and `limit`. |
| `GET` | `/courses/:idOrSlug` | User | Read one visible course. |
| `POST` | `/courses` | Admin | Create a draft course. Status in the request is ignored. |
| `PATCH` | `/courses/:id` | Admin | Update course metadata, modules, blocks, and assessment. |
| `POST` | `/courses/:id/publish` | Admin | Validate and publish. |
| `POST` | `/courses/:id/unpublish` | Admin | Return a published course to draft. |
| `POST` | `/courses/:id/archive` | Admin | Archive a course. |

Drafts may contain incomplete publish-only fields so work can be saved incrementally. Publishing requires complete metadata, at least one module, at least one valid assessment question, valid option/correct-answer relationships, and a pass mark from 0 through 100. Updating a published course cannot leave it in an invalid state.

Learner course responses omit `correctAnswer` and assessment explanations. Text is stored in structured `heading`, `paragraph`, `image`, `callout`, and `checklist` blocks rather than HTML.

## Progress

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/progress/me` | Current user | List personal course progress. `/progress` is an alias. |
| `GET` | `/progress/:courseId` | Current user | Read or initialize personal progress for one visible course. |
| `PUT` | `/progress/:courseId` | Current user | Save current module and completed module identifiers. |
| `GET` | `/progress/users/:userId` | Admin | Read one user's progress. |

The API validates that the module index and every completed module identifier belong to the course. Completion is derived by the server from a passing result plus all course modules; request-supplied status, user, score, or completion fields have no authority.

## Assessment attempts

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/attempts/me` | Current user | List personal attempts. `/attempts` is a GET alias. |
| `GET` | `/attempts/:id` | Attempt owner | Read one personal attempt. |
| `POST` | `/attempts` | Learner/user | Submit `{ courseId, answers }` for backend scoring. |

Each answer supplies a question identifier and selected option index. The API loads the protected answer key, applies question points, calculates percentage and pass/fail, creates the attempt, and updates best progress. Forged score, user, percentage, or result values are ignored by the validated request contract. After submission, the attempt response includes an immutable question snapshot, correctness, and the optional explanation for learner review.

## Media

All media routes require an administrator access token.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/media` | List media assets. |
| `POST` | `/media` | Upload multipart field `image` with required `altText`. |
| `DELETE` | `/media/:id` | Delete the database asset and its controlled local file. |

JPEG, PNG, WebP, and GIF are accepted. The server checks the MIME type, extension, dangerous double extensions, size, and file signature. Stored files are served from `/uploads/<generated-name>` and never use a client-supplied path.

Deleting a media asset that is still referenced by a course returns `409 MEDIA_IN_USE` with bounded course usage details; update those references before deleting the asset.

## Administration

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/admin/dashboard` | Course, user, progress, completion, and attempt metrics. |
| `GET` | `/admin/users` | Admin user listing alias. |
| `PATCH` | `/admin/users/:id` | Admin user update alias. |
| `GET` | `/admin/progress` | Learner progress with completion percentages. |
| `GET` | `/admin/results` | Assessment results. `/admin/attempts` is an alias. |
| `GET` | `/admin/results/export` | Download authoritative UTF-8 CSV. `/admin/results.csv` is an alias. |
| `GET` | `/admin/audit-logs` | Recent administrative audit events. |

CSV cells are quoted and values that could be interpreted as spreadsheet formulas are neutralized.

## Health and errors

`GET /health` returns `200` while MongoDB is connected and `503` otherwise.

Validation, authorization, and operational errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {},
    "requestId": "request-correlation-id"
  }
}
```

`details` is omitted when it is not useful. The same request identifier is exposed as `X-Request-Id` for support correlation.
