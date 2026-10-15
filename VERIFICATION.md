# Zynyro Verification Report

Date: 2026-10-15

## Local code checks

- `npm.cmd run verify` — **183 static checks passed**.
- `npm.cmd run build` — **production build passed** (`tsc -b` and Vite bundle).
- `git diff --check` — **passed**.
- Avatar picker now has **1,181 choices across 34 styles**: 33 illustrated styles with 35 unique variants each, plus A–Z Initials. Chibi Pop was removed from the picker; its 35 SVGs and IDs remain stored for existing profile compatibility.
- All 1,448 local SVG assets pass a global artwork-uniqueness check. Existing IDs through 1262 stay unchanged; 186 new assets append as IDs 1263–1448. New illustrations use 128 px intrinsic dimensions, scalable SVG viewBoxes, and stay below 16 KB each; DiceBear SVGs retain their embedded creator/license metadata.
- Avatar profile, text, voice, scheduled-message and database validation now accept IDs through 1448. Migration `20261015120000_expand_avatar_gallery_to_1448.sql` updates existing Supabase constraints and RPCs.
- Supabase Edge Function source audit found inconsistent service-key loading. All Edge Functions now use `supabase/functions/_shared/adminClient.ts`, which accepts `SUPABASE_SECRET_KEYS` (including `default`, `service_role`, `serviceRole`, or `key`), `SUPABASE_SECRET_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Public text send uses a stable request UUID and a database idempotency RPC. Failed public text sends are saved per account in browser storage and can be retried after reload. Realtime receives public inserts, with refresh fallback when database-change subscriptions are degraded.
- Call source requests browser echo cancellation and noise suppression, warns when the browser does not apply them, and includes speaker-volume controls and early ICE candidate buffering.
- Login UID/password autofill styling overrides the browser highlight so the input fill matches the surrounding field.

## Remaining live verification

These checks need the deployed Supabase project and real browser sessions/devices, so they were not claimed as passed here:

- Send and receive text between two separate accounts, including retry after disconnect and reload.
- Send and play voice messages on multiple browsers/devices.
- Start and receive Friends and Private calls, then test microphone mute, speaker volume, hang-up, and echo with real microphones and speakers.
- Confirm migrations `20261014120000_public_message_idempotency.sql` and `20261015120000_expand_avatar_gallery_to_1448.sql`, plus updated Edge Functions, are deployed to the linked Supabase project. The local environment could not confirm remote migration state.
- Inspect rendered layout at phone, tablet, and desktop widths. The local dev server at `127.0.0.1:5173` was not running during this scan, and the in-app browser was unavailable.

## Call network limitation

Friends and Private calls currently configure a public STUN server without a TURN relay. Calls can fail on restrictive NAT, firewall, or corporate/mobile networks. Browser echo cancellation also depends on the user's audio hardware and browser. A TURN service and real-device audio testing are needed before claiming calls work on every network or echo is eliminated.

## Before release

1. Link the intended Supabase project and run `supabase db push` so all migrations, including `20261014120000_public_message_idempotency.sql` and `20261015120000_expand_avatar_gallery_to_1448.sql`, are applied.
2. Deploy the updated Edge Functions so the shared service-key loader, message idempotency flow, and 1448-avatar validation are active.
3. Test with two independent accounts and devices. Confirm message persistence/retry, voice delivery/playback, calls, and responsive layouts before publishing.
