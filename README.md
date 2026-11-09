# Open Template Library

Upload or describe any form, plot its points and get a fill-in template. Save it,
share it, download a PDF. Work stays on your device.

    npm install
    npm run dev      # http://localhost:5173  (the app)
    npm run api      # http://127.0.0.1:8787  (the backend, in another terminal)
    npm run build    # static files in dist/
    npm run deploy   # build, then deploy the Worker and the app to Cloudflare

Every page is in `src/pages`, shared parts in `src/components`, and the design tokens
(colors, fonts, radius) in `site.json` and `tailwind.config.js`.

## Backend: Cloudflare, not Wron

The site was exported from Wron, whose hosted backend served the community list,
shares, reports, copy counts and AI help. That connection is replaced by a
Cloudflare Worker in this repo, so the data lives in your own account:

| What | Where |
| --- | --- |
| API (`/api/site/:id/db`, `/ai`, `/hit`, `/errors`) | `worker/index.js` |
| The four tables from `db/schema.json` | `worker/db.js` |
| Community list, shares, reports, copy counts | tables `community_templates`, `shared_templates`, `template_reports`, `template_copies` |
| AI help for Recreate (text and scans) | `worker/ai.js`, table `ai_usage` |
| Browser screenshots for Recreate | `worker/shot.js`, `BROWSER` binding |
| Schema and indexes | `migrations/0001_init.sql` |
| Worker, assets and D1 binding | `wrangler.jsonc` |

The client kit in `src/wron-kit` keeps its API (`table`, `useTable`, `ai`) and now
talks to this Worker: `index.html` sets `window.__SITE__` to the site's own
origin, and the kit calls `/api/site/<siteId>/<action>` there. Nothing is sent to
wron.ai, and the paper illustration is served from `public/`, not from Wron's
storage.

Access rules are enforced in the Worker, not the browser: anyone can read
published community templates, anyone can submit a share, a report or a copy,
and only you (in D1) can publish a share.

### First deploy

1. `npx wrangler login` (or set `CLOUDFLARE_API_TOKEN` in CI).
2. Create the database and copy its id into `wrangler.jsonc`:

       npx wrangler d1 create open-template-library

   Replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` with the `database_id` it prints.
3. Create the tables (remote, and `--local` for your dev database):

       npm run db:migrate
       npm run db:migrate:local

4. `npm run deploy`.

The Worker serves `dist/` and every non-API path falls back to `index.html`, so
`/privacy` and `/terms` load the app.

### Deploy from GitHub

In the Cloudflare dashboard: **Workers & Pages → Create application → Connect to
Git**, pick this repository, and use:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

Every push to `main` then builds and deploys to Cloudflare. Steps 1–3 above still
have to be done once, because the D1 database is yours; after that the `DB`
binding in `wrangler.jsonc` is all the build needs.

### Publishing a shared template

Shares wait in `shared_templates` (`status = 'pending'`) until you publish one:

    npx wrangler d1 execute open-template-library --remote --command \
      "INSERT INTO community_templates (id, title, category, author_name, content, shared_on, uses, created_at, updated_at)
       SELECT lower(hex(randomblob(16))), title, category, author_name, content, date('now'), 0, created_at, created_at
       FROM shared_templates WHERE id = 'PASTE_THE_SHARE_ID';"

Read the inbox and the reports with:

    npx wrangler d1 execute open-template-library --remote --command \
      "SELECT id, title, category, author_name, created_at FROM shared_templates ORDER BY created_at DESC"
    npx wrangler d1 execute open-template-library --remote --command \
      "SELECT template_title, reason, created_at FROM template_reports ORDER BY created_at DESC"

### AI help

Recreate works without AI by plotting points by hand or pasting one field per
line. The AI buttons call this Worker, which uses the `AI-PROXY` service binding
to this account's `ai-proxy` Worker (an `ORPROXY` binding to the orproxy entry
point is also declared). No OpenRouter key is stored in this Worker.

`wrangler.jsonc` sets `ORPROXY_MODEL` (`openai/gpt-4o-mini`, a vision model) and
`ORPROXY_URL`. A plain OpenAI-compatible URL (`ORPROXY_URL` +
`ORPROXY_API_KEY`) still works instead of the binding, and Workers AI (`"ai"`)
is the final fallback.

### Screenshot a page

`POST /api/site/<siteId>/shot` with `{ "url": "https://…" }` opens the page in
Cloudflare Browser Run through the `BROWSER` binding and returns a JPEG data
URL. In Recreate, **Paste a link → Screenshot the page → Detect with AI** turns
that capture into points. Captures count against `AI_DAILY_LIMIT` (20 per IP
per day by default) because each one starts a real browser.

`AI_DAILY_LIMIT` (default 20 per IP per day) keeps an open site from spending
without limit. With neither configured the AI buttons report that it is not
connected; nothing else breaks.

### Notes

- Saved templates, drafts, field answers and pictures stay in the browser's
  storage. Only a template you explicitly share is sent to the Worker, and field
  values and pictures are stripped before it is.
- Accounts, owner sign-in, Stripe checkout, file uploads and appointments were
  Wron features and are not implemented here; those kit methods answer with a
  readable "not set up" error or are unused.
