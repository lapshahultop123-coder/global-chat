# Zynyro Verification Report

Date: 2026-10-14

## Local code checks

- `npm.cmd run verify` — **180 static checks passed**.
- `npm.cmd run build` — **production build passed** (`tsc -b` and Vite bundle).
- `git diff --check` — **passed**.
- Supabase Edge Function source audit found inconsistent service-key loading. All Edge Functions now use `supabase/functions/_shared/adminClient.ts`, which accepts `SUPABASE_SECRET_KEYS` (including `default`, `service_role`, `serviceRole`, or `key`), `SUPABASE_SECRET_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Public text send uses a stable request UUID and a database idempotency RPC. Failed public text sends are saved per account in browser storage and can be retried after reload. Realtime receives public inserts, with refresh fallback when database-change subscriptions are degraded.
- Call source requests browser echo cancellation and noise suppression, warns when the browser does not apply them, and includes speaker-volume controls and early ICE candidate buffering.

## Remaining live verification

These checks need the deployed Supabase project and real browser sessions/devices, so they were not claimed as passed here:

- Send and receive text between two separate accounts, including retry after disconnect and reload.
- Send and play voice messages on multiple browsers/devices.
- Start and receive Friends and Private calls, then test microphone mute, speaker volume, hang-up, and echo with real microphones and speakers.
- Confirm the latest migration and Edge Functions are deployed to the linked Supabase project. The local environment could not confirm remote migration state.
- Inspect rendered layout at phone, tablet, and desktop widths. The local dev server at `127.0.0.1:5173` was not running during this scan, and the in-app browser was unavailable.

## Call network limitation

Friends and Private calls currently configure a public STUN server without a TURN relay. Calls can fail on restrictive NAT, firewall, or corporate/mobile networks. Browser echo cancellation also depends on the user's audio hardware and browser. A TURN service and real-device audio testing are needed before claiming calls work on every network or echo is eliminated.

## Before release

1. Link the intended Supabase project and run `supabase db push` so all migrations, including `20261014120000_public_message_idempotency.sql`, are applied.
2. Deploy the updated Edge Functions so the shared service-key loader and message idempotency flow are active.
3. Test with two independent accounts and devices. Confirm message persistence/retry, voice delivery/playback, calls, and responsive layouts before publishing.