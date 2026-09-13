# Deployment checklist

1. Create Supabase project.
2. Enable Anonymous Sign-Ins.
3. Run `supabase/schema.sql`.
4. Enable pg_cron and schedule:

```sql
select cron.schedule('global-chat-expiry', '* * * * *', $$delete from public.messages where expires_at <= now()$$);
```

5. Set Edge Function secret `SUPABASE_SECRET_KEY`.
6. Deploy `save-profile`, `send-message`, and `toggle-reaction`.
7. Copy `.env.example` to `.env` and add the browser-safe Supabase URL and publishable key.
8. Run `npm install` and `npm run build`.
9. Deploy `dist/` to an HTTPS static host with SPA fallback.
10. Test with two separate browser sessions: message delivery, presence, reactions, rate limit, and five-minute expiry.
