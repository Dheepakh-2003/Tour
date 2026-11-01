# Tour

A dynamic banner / blog showcase. Visitors see one large editorial banner at a time (image on the left, heading and description on the right) and move between banners with arrows, the keyboard or swipes. An admin signs in at `/admin` to add, edit and delete banners.

There is **no database**. Banner data lives in a single `banners.json` file and uploaded images live in a **Supabase Storage** bucket.

## Tech stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 19, Vite, React Router, plain CSS |
| API      | Node.js. Express for local development, Vercel serverless functions in production. Both run the **same handler code** |
| Storage  | Supabase Storage (`@supabase/storage-js`): images and `data/banners.json` |
| Auth     | scrypt-hashed admin password, HMAC-signed `HttpOnly` session cookie (no extra auth library) |
| Hosting  | GitHub, Vercel, Supabase (free tiers) |

## Folder structure

```
tour/
├── api/                      Vercel serverless functions (also mounted by Express locally)
│   ├── auth/  login.js  logout.js  me.js
│   └── banners/  index.js  [id].js
├── server/
│   ├── index.js              Local Express server (port 5000)
│   └── lib/                  Shared backend code
│       ├── auth.js           password check, signed session cookie
│       ├── bannerService.js  create / update / delete rules
│       ├── storage.js        Supabase Storage access, JSON read/write, write lock
│       ├── validate.js       input + image validation
│       ├── http.js           routing wrapper, JSON/multipart parsing, origin check
│       └── config.js  errors.js  supabase.js
├── scripts/hash-password.js  Generates ADMIN_PASSWORD_HASH and SESSION_SECRET
├── src/                      React app
│   ├── pages/        Landing.jsx  Admin.jsx
│   ├── components/   BannerSlider  BannerCard  BannerForm  ConfirmDialog  LoginForm  Toast
│   ├── services/api.js       All API calls
│   └── styles/
├── public/  index.html  vite.config.js  vercel.json
├── .env.example              Names of all required environment variables
└── package.json
```

## How storage works

```
<bucket>/
├── data/banners.json     banner records: header, description, images[] (paths + URLs, no Base64)
├── data/footer.json      footer profiles: people[] (name + photo)
└── uploads/<timestamp>-<uuid>.<ext>
```

* The bucket and an empty `banners.json` are **created automatically** on first use.
* **Concurrent writes are safe.** Every change runs under a lock: an in-process queue plus a `data/banners.lock` object created with Supabase's "create only if absent" upload, which acts as a cross-instance mutex (needed on serverless). Stale locks expire after 20 s.
* Replacing or deleting a banner removes its old image from storage, but only if no other banner still references it.
* The bucket is **public** so visitors' browsers can load the images directly. The service-role key never leaves the server, and only the API can write.

## Setup

### 1. Supabase

1. Create a free project at <https://supabase.com>.
2. Open **Project Settings → API**. Copy:
   * **Project URL** → `SUPABASE_URL`
   * **service_role** key (under "Project API keys"; click *Reveal*) → `SUPABASE_SERVICE_ROLE_KEY`
3. That is all. You do **not** need to create tables or the bucket. The app creates a public bucket named by `SUPABASE_BUCKET_NAME` (default `tour-storage`) on first request.
   * If you prefer to create it yourself: **Storage → New bucket**, name `tour-storage`, enable **Public bucket**.
4. Keep the service-role key secret. It bypasses all access rules. Never put it in frontend code or commit it.

### 2. Admin password

```bash
npm install
npm run hash-password -- "choose-a-strong-password"
```

It prints two lines, `ADMIN_PASSWORD_HASH=...` and `SESSION_SECRET=...`. Keep them for the next step. The plain password is never stored anywhere.

### 3. Local `.env`

```bash
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
```

Fill in `.env`:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_BUCKET_NAME=tour-storage
ADMIN_PASSWORD_HASH=<from step 2>
SESSION_SECRET=<from step 2>
APP_URL=http://localhost:5173
```

`.env` is git-ignored.

## Run locally

```bash
npm install
npm run dev
```

| What          | URL |
|---------------|-----|
| Landing page  | <http://localhost:5173/> |
| Admin panel   | <http://localhost:5173/admin> |
| API           | <http://localhost:5000/api/banners> |

Vite proxies `/api` to the Express server, so the browser only talks to one origin (cookies just work). Stop with `Ctrl+C`.

Other scripts: `npm run build` (production build into `dist/`), `npm run preview`.

## Push to GitHub

The repository already exists and `main` is pushed. After reviewing the changes:

```bash
git status
git add .
git commit -m "Build Tour banner showcase"
git push origin main
```

`.env` is ignored by `.gitignore`. Run `git status` first and confirm no `.env` file is listed.

## Deploy to Vercel (free)

1. Push the code to GitHub (above).
2. Go to <https://vercel.com> → **Add New… → Project** → import `Dheepakh-2003/Tour`.
3. Vercel detects Vite. Leave the defaults (build `npm run build`, output `dist`). `vercel.json` already routes `/api/*` to the functions and every other path to `index.html`, so opening `/admin` directly works.
4. Open **Environment Variables** and add (for *Production*, and *Preview* if you want previews to work):

   | Name | Value |
   |------|-------|
   | `SUPABASE_URL` | your project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service-role key |
   | `SUPABASE_BUCKET_NAME` | `tour-storage` |
   | `ADMIN_PASSWORD_HASH` | hash from `npm run hash-password` |
   | `SESSION_SECRET` | the 64-char secret from the same command |
   | `APP_URL` | `https://<your-project>.vercel.app` (add after the first deploy) |

5. Click **Deploy**. When it finishes, open the URL Vercel gives you:
   * `https://<your-project>.vercel.app/` is the public landing page. Share this one.
   * `https://<your-project>.vercel.app/admin` is the admin login.
6. If you add or change an environment variable later, **redeploy** (Deployments → ⋯ → Redeploy). Variables only apply to new deployments.

## Admin login

The admin password is whatever you passed to `npm run hash-password`. To change it, run the command again, replace `ADMIN_PASSWORD_HASH` (and ideally `SESSION_SECRET`, which signs out every session) in `.env` and in Vercel, then redeploy.

Sessions last 8 hours, use an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production), and failed logins are rate-limited per IP on a best-effort basis.

## API

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/banners` | public | list |
| GET | `/api/banners/:id` | public | one banner |
| POST | `/api/banners` | admin | JSON: `header`, `description`, `images` (1–8 upload paths) |
| PUT | `/api/banners/:id` | admin | same JSON; dropped images are deleted |
| DELETE | `/api/banners/:id` | admin | |
| POST | `/api/uploads` | admin | `multipart/form-data` with one `image`; returns `{ path, url }` |
| DELETE | `/api/uploads` | admin | discards an unsaved upload (never an image in use) |
| GET | `/api/footer` | public | `{ people: [{ id, name, image, imagePath }] }` |
| PUT | `/api/footer` | admin | JSON: `people: [{ id?, name, imagePath? }]` (up to 30; replaces the list) |
| POST | `/api/auth/login` | – | `{ "password": "..." }` |
| POST | `/api/auth/logout` | – | |
| GET | `/api/auth/me` | – | `{ "authenticated": true/false }` |

Images are uploaded one at a time (each up to 4 MB, so every request stays under Vercel's ~4.5 MB limit); the admin form shrinks very large phone photos automatically. Validation: header ≤ 120 chars, description ≤ 2000 chars, image JPG/JPEG/PNG/WEBP up to **4 MB** (extension, MIME type *and* file signature are checked). The 4 MB cap keeps requests under Vercel's ~4.5 MB function body limit. Image paths are generated by the server, never taken from the client.

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| `500 Server is not configured correctly` | An environment variable is missing or malformed. The server log names it. On Vercel check **Settings → Environment Variables** and redeploy. |
| Login always says "Incorrect password" | `ADMIN_PASSWORD_HASH` was copied incompletely. It must be `<32 hex>:<128 hex>`. Regenerate it. Avoid quotes or trailing spaces in Vercel. |
| Login works but you are logged out immediately | `SESSION_SECRET` is missing or under 32 characters, or differs between instances. |
| `Cannot reach Supabase Storage` in logs | Wrong `SUPABASE_URL`, or a wrong or truncated service-role key. |
| Images upload but do not display | The bucket is not public. Storage → bucket → make it public. |
| Image upload fails with 413 | The file is over 4 MB. Compress it. |
| `/admin` gives 404 on Vercel | `vercel.json` was not deployed. Check it is at the repo root. |
| "The server is busy" (503) | Another write held the lock for over 12 s. Retry. A crashed write's lock expires after 20 s. |
| Landing page does not show a change | It refreshes on tab focus and every 30 s. Reload to see it immediately. |

## Notes and limits

* Free-tier limits of Vercel and Supabase apply (storage size, bandwidth, function time).
* `banners.json` is read in full on every request. That is fine for dozens or hundreds of banners; if you expect many thousands, a database would be the better choice.
