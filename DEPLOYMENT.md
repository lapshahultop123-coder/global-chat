# Deployment checklist

1. Create Supabase project.
2. Enable Anonymous Sign-Ins.
3. For an existing project, link it and run `supabase db push` so every migration in `supabase/migrations/` is applied. For a brand-new project, run `supabase/schema.sql` first and then `supabase db push`.
4. Enable pg_cron and schedule:

```sql
select cron.schedule('global-chat-expiry', '* * * * *', $$delete from public.messages where expires_at <= now()$$);
```

5. Set Edge Function secret `SUPABASE_SECRET_KEY`.
6. Deploy all included Edge Functions: `save-profile`, `send-message`, `send-voice`, `delete-voice-for-everyone`, `toggle-reaction`, `toggle-voice-reaction`, and `cleanup-voice-messages`.
7. Copy `.env.example` to `.env` and add the browser-safe Supabase URL and publishable key.
8. Run `npm install` and `npm run build`.
9. Deploy `dist/` to an HTTPS static host with SPA fallback.
10. Test with two separate browser sessions: message delivery, presence, reactions, rate limit, and five-minute expiry.
