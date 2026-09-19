# 🌍 GLOBAL CHAT

Production-oriented single-room public chat built with React + Vite + Supabase.

## Architecture

- **Frontend:** React + TypeScript + Vite
- **Realtime:** Supabase Realtime Presence + Postgres Changes
- **Anonymous identity:** Supabase Anonymous Sign-ins — no email, password, or social account required
- **Server validation:** Supabase Edge Functions + PostgreSQL security-definer functions
- **Security:** Row Level Security on every exposed table; direct message inserts are blocked
- **Country/subdivision data:** `iso-3166` package, using ISO 3166-1 assigned countries and ISO 3166-2 subdivisions
- **No uploads:** no file input, camera, gallery, or image upload path exists
- **Avatars:** exactly 100 fixed local image avatars; no avatar emoji text is used by the website UI

Supabase supports anonymous sign-ins without collecting PII, and authenticated anonymous users can be protected with RLS.

## 1. Create the Supabase project

1. Create a Supabase project.
2. In **Authentication → Providers**, enable **Anonymous Sign-Ins**.
3. Copy the project URL and **publishable key** into `.env`.
4. Keep the **secret key** only in the Supabase Edge Function environment. Never put it in the browser.

Supabase's current API-key guidance is to use a publishable key in shipped browser code and a secret key only in trusted server/Edge Function code.

## 2. Database

For an existing Supabase project, use the included migrations with `supabase db push` after linking the project. `supabase/schema.sql` contains the base schema for a fresh setup; the migrations add the complete private-chat, voice, moderation, reply, and room-code features.

Then enable `pg_cron` in the Supabase Dashboard if it is available for the project and schedule the cleanup query at the bottom of the SQL file. The application also filters expired messages with `expires_at`, so expired rows are not readable even between cleanup runs.

## 3. Realtime

The schema adds `messages` and `message_reactions` to `supabase_realtime` and creates RLS policies for the private `global-chat` presence channel.

Supabase Presence supports a custom presence key, so this project uses the anonymous Supabase user ID as the key; multiple tabs for the same persisted anonymous session therefore collapse to one presence key rather than inflating the visible count.

## 4. Deploy Edge Functions

Install the Supabase CLI, log in, link the project, and deploy:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy save-profile
supabase functions deploy send-message
supabase functions deploy toggle-reaction
```

Set the server-only secret if your project does not automatically expose it to functions:

```bash
supabase secrets set SUPABASE_SECRET_KEY=sb_secret_...
```

Do **not** put `SUPABASE_SECRET_KEY` in `.env` used by Vite.

## 5. Frontend

```bash
npm install
copy .env.example .env
# edit .env with your Supabase URL and publishable key
npm run dev
```

Production build:

```bash
npm run build
```

Deploy the `dist/` folder to any static host such as Cloudflare Pages, Netlify, Vercel, GitHub Pages with the appropriate SPA fallback, or your own HTTPS server.

## Security model

The browser can read currently active messages, but cannot insert messages directly. Message creation goes through `send-message`, which validates:

- anonymous authenticated session
- ISO country + subdivision
- nickname length
- fixed avatar ID
- fixed theme ID
- English-only scripts
- approved emoji set
- 500-character limit
- offensive-language normalization/filtering

The database function takes an advisory transaction lock per user before checking the 3-in-10-seconds window, preventing two concurrent requests from racing past the limit.

Reactions are restricted to the exact eight allowed values and protected by a composite primary key.

## Important dataset note

The project deliberately uses the `iso-3166` dataset rather than a hand-written country list. Its current package exports assigned ISO 3166-1 countries and ISO 3166-2 subdivision records, including full subdivision codes such as `US-CA`. Keep the dependency updated when ISO publishes revisions and review any dataset changes before a production release.

## Product restrictions intentionally enforced

- One global room only
- No DMs/private chat/groups/admin dashboard/online-user list
- 100 fixed avatar IDs; no upload UI
- 25 fixed themes; no custom themes/backgrounds
- Text-only messages
- Curated emoji picker
- Exactly 8 reactions
- 3 messages / 10 seconds server-side
- 500 characters server-side
- Individual 5-minute message expiry
- No permanent history
- No browser/push notifications
- Two optional short sounds only

## Verification

Run `npm run verify` for the repository's static implementation checks. A successful production build requires npm registry access because dependencies are installed from npm. The supplied archive intentionally does not contain `node_modules`.
