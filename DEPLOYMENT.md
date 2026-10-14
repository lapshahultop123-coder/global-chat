# Deployment checklist

1. Create the Supabase project.
2. Enable Anonymous Sign-Ins.
3. Link the intended project. For an existing project, run `supabase db push` to apply every migration in `supabase/migrations/`, including the latest public-message idempotency migration. For a brand-new project, run `supabase/schema.sql` first, then `supabase db push`.
4. Enable pg_cron and schedule:

```sql
select cron.schedule('global-chat-expiry', '* * * * *', $$delete from public.messages where expires_at <= now()$$);
```

5. Configure the Edge Function service credential as `SUPABASE_SECRET_KEYS` (JSON with a `default` key), `SUPABASE_SECRET_KEY`, or `SUPABASE_SERVICE_ROLE_KEY`. The functions use the shared loader at `supabase/functions/_shared/adminClient.ts`.
6. Deploy all included Edge Functions after applying migrations: `save-profile`, `send-message`, `send-voice`, `send-thread-reply`, `delete-voice-for-everyone`, `toggle-reaction`, `toggle-voice-reaction`, `cleanup-voice-messages`, `account-recovery`, `delete-account-chats`, `submit-feedback`, and `schedule-text`.
7. Copy `.env.example` to `.env` and add the browser-safe Supabase URL and publishable key.
8. Run `npm install`, `npm run verify`, and `npm run build`.
9. Deploy `dist/` to an HTTPS static host with SPA fallback.
10. Test with two separate browser sessions: signup/login, public/private/friend text send and receive, reconnect retry, voice-message send and playback, reactions, presence, rate limits, and expiry.
11. Test Friends and Private calls on real devices, including incoming/declined calls, mic mute, speaker volume, and audio echo. Calls currently use STUN without TURN, so some NAT/firewall/mobile networks may need a TURN relay configured before calls can connect reliably.