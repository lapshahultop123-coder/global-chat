# Zynyro — Verification Report

Date: 2026-09-28

## Static verification

`node scripts/verify.mjs` completed successfully: **96 static checks passed**.

The checks cover the existing public/private chat, voice-message, reactions, replies, presence, friends, and database safeguards, plus:

- Friends 1:1 WebRTC call UI and signaling flow
- Incoming call, accept/decline, connected/calling states, mic mute, speaker mute, and end-call controls
- Server RPC validation that both users are accepted friends and neither has blocked the other
- Persistent Friends call listener while the Friends panel is open
- Unique database-assigned 10-digit numeric public UID and Settings display
- Friends directory name and state/country display
- Mojibake scan across application source files

## Production build

A production build could **not** be completed in this environment because npm dependencies could not be installed.

Attempted:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm install --offline --ignore-scripts --no-audit --no-fund
```

The first command timed out; the offline attempt failed because the required package tarballs were not cached. A global TypeScript check also could not run because the project's installed type definitions and packages are unavailable. Therefore this report does **not** claim that `npm run build` passed.

Before deployment, run on Windows in the project folder:

```powershell
npm.cmd install
npm.cmd run verify
npm.cmd run build
```

## Required Supabase migration

Apply this new migration before testing the new Friends features:

```text
supabase/migrations/20260928120000_friends_calls_and_public_uid.sql
```

It assigns each existing profile a unique numeric UID, sets the default for new profiles, adds a restricted Friends directory RPC, and adds a server-side call eligibility check. The migration is included in the ZIP but has not been applied to the remote Supabase project by this packaging step.

## Voice-call network note

Friends calls use WebRTC audio and Supabase Realtime signaling, with a public STUN server. Calls may not connect on some restrictive mobile/corporate networks without a TURN server. Calls are intended for friends who are online with the Friends panel open to receive the incoming-call prompt.
