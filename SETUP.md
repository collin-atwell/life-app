# Setup guide — hosting + backend (total ≈ 20 min, $0/month)

Everything in the app already works offline on this computer. This guide adds:

- **Part 1 — GitHub Pages**: the app on the internet with a real URL, installable
  on your phone as a PWA.
- **Part 2 — Supabase backend**: account sign-in + automatic sync across devices.

The two parts are independent — you can do either one alone.

---

## Part 1: Put the app on GitHub Pages

GitHub can't run a backend server, but it hosts static apps like this one for free,
and the deploy workflow is already in the repo (`.github/workflows/deploy.yml`).

1. **Create the repo.** Go to https://github.com/new, name it (e.g. `health-hub`),
   keep it **Public** (Pages is free on public repos), do **not** add a README, click
   **Create repository**.

2. **Push the code.** In Terminal:

   ```bash
   cd "/Users/collinatwell/new fitness:journal:schedule app"
   git init
   git add .
   git commit -m "Health Hub v1"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/health-hub.git
   git push -u origin main
   ```

   (If git asks who you are first: `git config --global user.email "you@example.com"`
   and `git config --global user.name "Your Name"`.)

3. **Turn on Pages.** In the repo on github.com: **Settings → Pages →
   Build and deployment → Source: GitHub Actions**.

4. **Wait ~2 min.** The Actions tab shows the deploy running. Your app appears at
   `https://YOUR_USERNAME.github.io/health-hub/`.

5. **Install it on your phone.** Open that URL →
   - iPhone (Safari): Share button → **Add to Home Screen**
   - Android (Chrome): menu → **Install app**

   It launches full-screen with the ⚡ icon and works offline after the first visit.

Every future `git push` to `main` redeploys automatically.

---

## Part 2: The backend (Supabase free tier)

Supabase gives you a hosted Postgres database + user accounts. The free tier
(500 MB, 50k monthly users) is far more than this app will ever need.

1. **Create the project.** Go to https://supabase.com → sign up (you can use your
   GitHub account) → **New project**. Pick any name (`health-hub`), a strong database
   password (save it somewhere, though the app never uses it), the region closest to
   you, and the **Free** plan. Wait ~1 min for provisioning.

2. **Create the table.** In the left sidebar: **SQL Editor → New query**. Open
   [`supabase/schema.sql`](supabase/schema.sql) from this folder, paste its entire
   contents, click **Run**. You should see "Success. No rows returned."

3. **Simplify sign-up (recommended).** Sidebar: **Authentication → Sign In / Up →
   Email** → turn **off** "Confirm email". (Skip this if you want confirmation
   emails; the app handles both.)

4. **Copy your keys.** Sidebar: **Project Settings → API Keys**, plus **Project
   Settings → General** for the URL. You need:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon / public key** — a long string starting with `eyJ` or `sb_publishable_`

   The anon key is safe to expose — the row-level-security policies in the schema
   mean each signed-in user can only ever read/write their own row.

5. **Connect the app.** In Health Hub: **Settings → Cloud sync & backup** → paste
   the URL and anon key → **Connect** → enter an email + password → **Create
   account** → **Sign in**. Your data uploads on first sign-in.

6. **Second device.** Open the app there (your GitHub Pages URL), Settings → Cloud
   sync → same URL/key → **Sign in**. It pulls your data down. From then on, both
   devices auto-sync: changes upload a few seconds after you make them, and each
   device adopts the newest copy on launch.

### How sync behaves

- **Last write wins.** Your whole dataset syncs as one document with a timestamp.
  If you edit on two devices while both are offline, the one that syncs last wins.
  For a single-person health app this is the right trade-off vs. merge complexity.
- **Offline-first.** No connection? Everything still works; it syncs next launch.
- **Manual controls.** "Push now" / "Pull latest" in Settings if you ever want to
  force a direction.

---

## Later (needs the backend above, ~30 extra min when you want it)

**Push notifications with the app closed** — the service worker already listens for
web-push events (`public/sw.js`). Completing it requires a Supabase Edge Function
that stores push subscriptions and a scheduled job (cron) that sends VAPID-signed
pushes for your reminder times. Ask Claude to build it once Parts 1–2 are live,
since it needs your deployed URL + Supabase project to test against.
