FULL GLOBAL CHAT UTF-8 FIX

Scans all text source files under src/, public/, and index.html.
Repairs corrupted UTF-8/mojibake including broken emoji and symbols.

Run:
node global-chat-utf8-full-fix.mjs
npm run build

If build succeeds:
git add src public index.html
git commit -m "Fix all global UTF-8 mojibake"
git push origin HEAD:main
