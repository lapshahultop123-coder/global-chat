# Friends release QA checklist

Run this checklist on a staging Supabase project with two independent authenticated accounts (A and B).

## Requests and presence
- [ ] A sends B a request; B sees one incoming request.
- [ ] B accepts; each account sees the other once in Friends.
- [ ] Reject and cancel leave no friendship.
- [ ] Self-request, existing-friend request, duplicate request, and rapid repeat are rejected server-side.
- [ ] Online/offline and last-seen behavior is checked after closing/reopening the panel and reconnecting.

## Messages and notifications
- [ ] Text, emoji, reply, reactions, timestamps, and sender/receiver alignment work both ways.
- [ ] Typing indicator clears after typing stops or disconnects.
- [ ] Unread counts update, mark read, and persist after refresh without duplication.
- [ ] Search filters the selected conversation only.
- [ ] Delete for me remains hidden for that user after refresh; other participant still sees it.
- [ ] Delete for everyone is available only to the sender and removes the message for both.
- [ ] Clear chat affects only the current user's view.

## Voice and calls
- [ ] Record, cancel, preview, send, play, pause/resume, seek, speed, duration, and waveform are checked.
- [ ] Oversize/over-duration upload errors are understandable and leave no orphaned object.
- [ ] Calls: incoming, accept, reject, end, mute, duration, disconnect, and permission-denied paths.
- [ ] Test calls on separate networks; add TURN if STUN-only connectivity is insufficient.

## Blocking, privacy, and responsive UI
- [ ] Blocking prevents messages, calls, and new requests in both directions.
- [ ] Blocked user is not shown as a normal friend; unblock does not recreate friendship.
- [ ] RLS prevents reading/writing another pair's data and hidden-message rows.
- [ ] Storage policies prevent unauthorized voice access.
- [ ] Test mobile and desktop, empty/loading/error states, reconnect, and pagination.
- [ ] Verify account deletion cleanup and last-seen privacy controls before release; these are not certified by the source-only checks.

## Build and deployment
- [ ] `npm.cmd ci`
- [ ] `npm.cmd run verify`
- [ ] `npm.cmd run build`
- [ ] `supabase.cmd db push` against the intended project
- [ ] Smoke-test existing Public and Private Chat after applying migrations.
