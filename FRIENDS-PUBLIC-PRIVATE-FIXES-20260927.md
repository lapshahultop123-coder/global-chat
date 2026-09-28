# Zynyro fixes — 2026-09-27

## Public Chat
- Kept the existing optimistic text-message flow so the sender sees the message immediately while the send request completes.
- Added an immediate “Sending voice message…” status while the recorded audio is uploaded and persisted. Voice delivery still depends on the network and Supabase upload completing.

## Private Chat
- Removed the duplicate Reply action from text and voice three-dot menus. The compact Reply action beside reactions remains available.
- Kept Delete for me, Delete for everyone (sender only), and Cancel in the message menus. The Add Friend action remains for other users' messages.

## Friends
- Replaced the browser prompt on the friend three-dot action with a real button menu: Message, Block/Unblock, Pin/Unpin, Delete Friend, and Profile.
- Added locally persisted pinning per signed-in user; pinned friends sort before other friends.
- Blocked friends remain visible in the Friends list with a Blocked status and an Unblock action.
- Added a migration that restores the friendship row when the user unblocks someone. This addresses friendships removed by the previous block function.

## Database
Run `supabase db push` after linking the project to apply `20260927130000_restore_friendship_on_unblock.sql`.

## Validation
- TypeScript project check passed (`tsc -b`).
- Static verification script passed (83 checks).
- Vite production build could not be completed in this environment because the archive's installed dependencies lack the Linux Rollup optional package. Reinstall dependencies on the target machine with `npm.cmd install`, then run `npm.cmd run build`.
