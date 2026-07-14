# Architecture

## System shape

```text
React/Vite client
  |  JSON over /api/v1, access token in memory
  |  secure HTTP-only refresh cookie
  v
Express/TypeScript API
  |-- MongoDB through Mongoose
  |-- local image storage through MediaAsset records
  `-- Google OAuth when configured
```

The npm workspace keeps deployable applications separate:

- `client/` owns routing, presentation, session bootstrap, accessibility, learner workflows, and the admin editing experience.
- `server/` is the authority for identity, roles, publication state, progress, assessment scoring, media validation, and audit records.
- `docs/` records operations, API contracts, security decisions, and migration provenance.

## Trust boundaries

The browser is never trusted to set an administrator role, validate an instructor code, claim course ownership, set a score/pass result, change publication state, or supply another learner's identity. Public role input is constrained to learner/instructor, and instructor authorization is re-established from `Course.createdBy` on every protected operation. Learner course responses omit correct answers. Assessment submissions carry only selected answers; the API loads the current assessment, calculates the score, stores the immutable attempt, and updates derived progress.

Short-lived access tokens are returned to the client and held only in JavaScript memory. Long-lived refresh credentials are signed JWTs in an HTTP-only cookie. The database holds only a one-way token digest and revocation metadata. Refreshing rotates the token and revokes the prior record; logout revokes the active record and clears the cookie.

Admin and instructor authorization are enforced in server middleware and are not dependent on whether the client hides a navigation item. Admin-only routes remain under `/admin`; instructor progress/result routes first resolve the instructor's owned course identifiers and scope every query to them.

## Core data relationships

```text
User 1 -- * RefreshToken
User 1 -- * CourseProgress * -- 1 Course
User 1 -- * AssessmentAttempt * -- 1 Course
User 1 -- * MediaAsset
User 1 -- * AuditLog
Course 1 -- * embedded Module -- * embedded ContentBlock
Course 1 -- 1 embedded Assessment -- * embedded Question
```

Course content is embedded because modules, blocks, and questions are authored and published as one bounded course document. Progress references stable embedded module identifiers rather than duplicating course content.

## Media boundary

Version one stores images under the server's controlled uploads directory. Multer receives generated filenames only after MIME type, extension, and size checks. The database stores a public URL and metadata, so a later S3-compatible adapter can replace local persistence without changing course documents.

Generated uploads are ignored by Git. Only the empty directory marker and intentionally authored visual placeholders belong in the repository.

## Runtime behavior

Startup validates the environment before opening the HTTP listener. The process handles MongoDB connection failure explicitly and shuts down cleanly on termination signals. Requests receive an identifier, and centralized error middleware converts operational and validation failures to the shared JSON error shape.

The client uses route-level shells for auth, learner, instructor, and admin contexts. A first-time Google identity finishes role selection in the auth context before any role shell becomes available. A single theme provider applies `data-theme` to the document root and persists the `itcp-branding-theme` preference. UI state components and accessible focus behavior are shared rather than reimplemented page by page.
