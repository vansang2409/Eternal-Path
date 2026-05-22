# Task 5.2 — Password auth + session token

> Sprint 5 · Priority 2. Read AGENTS.md first. Keep the server fully authoritative.

## Goal

Login is email-only, so anyone can claim any account. Add a password (set on first login, verified afterward) and a lightweight session token so a returning player can auto-login without retyping the password.

## Context files

- `database/schema.sql` — `accounts` table.
- `server/src/db/PlayerRepository.ts` — account creation/lookup; add password hash storage + verification helpers.
- `server/src/game/GameWorld.ts` — login handler.
- `shared/src/types.ts` — `LoginPayload`, server/client events.
- `client/index.html`, `client/src/game/GameScene.ts`, `client/src/i18n.ts` — login form + flow.

## Requirements

- Hash passwords with Node's built-in `crypto` (e.g. `scrypt` + a per-account random salt). No new dependencies.
- Add a `password_hash` column to `accounts` (idempotent ALTER). For the in-memory fallback, store the hash in memory too.
- First login for an email: set the password (create the account with the hash). Subsequent logins: verify the password; reject mismatches with a clear, localized error shown in the login form.
- Issue a session token on successful login (random, stored server-side in memory keyed by token -> email). Send it to the client; the client stores it in `localStorage`.
- On load, if a stored token exists, the client attempts a token login first; the server logs the player in if the token is valid, otherwise asks for email/password. Tokens are in-memory only (server restart invalidates them — acceptable).
- Add a password field to the login form. Keep the existing email + character-name fields and the existing login-overlay keyboard capture.

## DO NOT

- Do not add new npm dependencies (use `node:crypto`).
- Do not store plaintext passwords anywhere.
- Do not weaken the existing email validation.

## Acceptance criteria

- [ ] First login for a new email sets the password; logging in again with the wrong password is rejected with a clear message.
- [ ] Correct password logs in and loads the saved character.
- [ ] After a successful login, reloading the page auto-logs-in via the stored token (until server restart).
- [ ] `npm run typecheck` and `npm run build` pass.
