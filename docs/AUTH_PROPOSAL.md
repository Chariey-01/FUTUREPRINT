# Proposal: mandatory login for career exploration

**Status:** awaiting team decision. Nothing has been implemented.
**Author:** Person 1 (frontend) · **Date:** 2026-11-07 · **Audited at:** `0a63045` (includes `main` up to PR #4)

## 1. Audit: what exists today

| Area | Finding |
|---|---|
| **Backend accounts** | None. No users table, password storage, or login, logout, register or password-reset endpoints in `server/app`. |
| **Backend "authentication"** | Only anonymous simulator sessions. `POST /api/v1/sessions` issues an `fps_…` bearer token (256-bit, stored as SHA-256). `session_service.authenticate()` validates it. This identifies a *journey*, not a *person*. |
| **Public API** | `/health`, `/occupations`, `/occupations/<slug>`, `/evidence`, `/workforce-events`, `/methodology`, `/reports/<share_token>`, `/insights/*` |
| **Token-protected API** | `/sessions/current`, `/sessions/current/choices`, `/sessions/current/report` (anonymous session token) |
| **Frontend login page** | `/signin` is a **design preview**. It validates fields but deliberately sends and stores nothing, and is labelled as such. |
| **Frontend route guards** | None (all routes are anonymous by design). |
| **PRD** | Anonymous-first: "Do not require registration or login." |

**Conclusion:** there is no real authentication system to connect the login page to. Mandatory login needs (a) a team decision to change the PRD scope and (b) backend account support from Person 2. The frontend cannot provide either securely by itself; a client-side flag such as `localStorage.isLoggedIn` is not authentication.

## 2. Decisions needed from the team

1. **Scope:** do we replace anonymous-first access with mandatory login for the hackathon MVP? (Judges would then need test accounts.)
2. **Identity provider:** build accounts in the existing Flask backend (Person 2), or use a managed provider? The recommendation for the hackathon is Flask, to avoid a second auth system.
3. **Research transparency:** do `/observatory`, `/methodology` and the research content stay public? The recommendation is yes (PRD emphasis on evidence transparency).
4. **Existing anonymous sessions:** attach new sessions to the signed-in user, or keep anonymous sessions separate? The recommendation is to attach new sessions only; never merge or expose existing ones.
5. **Shared reports:** do `/reports/<share_token>` links stay public, or require the owner's login?

## 3. Backend dependencies (Person 2, if approved)

- **Data:** `users` table (email unique and case-folded; password hash with argon2id or bcrypt); `anonymous_sessions.user_id` nullable foreign key, plus a migration.
- **Endpoints:** `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, and password reset if in scope.
- **Session mechanism:** an httpOnly, Secure, SameSite=Lax cookie (recommended), or a short-lived bearer token. Never readable by page scripts if avoidable.
- **Server-side enforcement:** protected endpoints verify the user, sessions and reports are scoped to their owner (no cross-user access), and stale or revoked sessions are rejected with 401.
- **Abuse protection:** rate limiting on login, register and reset; generic "invalid email or password" errors (no account enumeration).
- **CORS:** if cookies are used cross-origin, set `supports_credentials` and an explicit origin.

## 4. Frontend plan (Person 1, once 1–3 are agreed)

- **Keep the login page design.** Wire `/signin` to `POST /auth/login` and `POST /auth/register` with loading and duplicate-submit protection, inline errors for wrong credentials, network failure and service unavailable.
- **`AuthProvider`:** state comes from `GET /auth/me` (TanStack Query). It's the only source of truth and is re-checked on load and on any 401.
- **`RequireAuth` guard:** wraps `/start`, `/simulate`, `/report`, `/occupations/:slug` (and future `/app/*` routes). It shows a loading state while auth initialises, redirects to `/signin?next=<path>`, and avoids loops. `next` is accepted only for same-origin relative paths.
- **Begin:** goes to `/start` if signed in, otherwise to `/signin?next=/start`.
- **Navbar:** signed out shows "Sign in"; signed in shows "My Journey" plus an account menu with Log out. Logout calls `POST /auth/logout` and clears cached user data.
- **Tests:** all 11 scenarios from the brief (Vitest + Playwright), including back-button and direct-URL access after logout, and backend 401 checks against the real API.

## 5. Until a decision is made

The current anonymous journey and the labelled sign-in preview stay as they are.
