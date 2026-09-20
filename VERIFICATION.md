# GLOBAL CHAT — Final Verification Report

Date: 2026-09-13

## Static verification

`npm run verify` completed successfully.

Result: **35 static checks passed.**

The checks cover:

- Exactly 100 unique fixed avatar records and IDs 1–100
- Exactly 25 fixed themes
- Exactly 8 reactions
- Client/server 500-character validation
- Client/server English-only validation
- Offensive-language filtering
- Server-side 3 messages / 10 seconds enforcement
- Atomic per-user rate-limit locking
- 5-minute message expiry
- Expired-message cleanup query
- Fixed avatar/theme server validation
- ISO country/subdivision server validation
- Reaction constraints and server validation
- RLS enabled
- Direct message inserts blocked
- Private Realtime channel authorization
- Realtime table publication
- Presence-based online count
- Realtime cleanup
- Anonymous authentication
- No upload input
- No browser Notification API
- Exactly two audio assets
- Four text sizes
- Fixed emoji picker
- No DM/group/admin UI
- Production build script and TypeScript configs

## TypeScript/build verification

A production build could **not** be completed in this environment because npm dependencies are not available locally and npm registry access timed out.

Attempted:

```bash
npm install
```

Result: command timed out after 300 seconds.

Offline fallback:

```bash
npm install --offline --ignore-scripts
```

Result: failed because the required npm packages were not cached locally.

A direct global TypeScript check was also attempted, but it reports missing installed packages (`react`, `@supabase/supabase-js`, `iso-3166`, `lucide-react`, etc.), which is expected when `npm install` cannot complete. It does not constitute a successful build.

Therefore this report deliberately does **not** claim `npm run build` passed.

## Dataset verification

The frontend and Edge Functions use `iso-3166` 4.4.0's `iso31661` assigned-country list and `iso31662` subdivision list. The package documentation confirms these exports are the assigned ISO 3166-1 countries and ISO 3166-2 subdivisions.

## Backend review

The Supabase implementation includes:

- RLS on all public application tables
- Direct message insertion blocked
- Server-side message acceptance function
- Per-user advisory transaction lock for rate limiting
- Server-side Edge Function validation
- Private Realtime channel authorization
- Realtime message/reaction publication
- Presence tracking keyed by anonymous user ID
- Individual `expires_at` timestamps
- Scheduled cleanup instructions using pg_cron
- Fixed reaction constraint
- Fixed avatar/theme validation

## Final build requirement

Before deploying to production, run on a machine with npm registry access:

```bash
npm install
npm run verify
npm run build
```

Only a successful local `npm run build` should be treated as final build confirmation.
