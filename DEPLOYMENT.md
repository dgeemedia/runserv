# Deploying RunServer

Three pieces, in this order — each one depends on info from the previous:

1. **Supabase** — Postgres database
2. **Render** — backend API + two cron jobs
3. **Vercel** — the Next.js web app (client dashboard + admin)

Do them in this order because Render needs Supabase's connection string,
and Vercel needs Render's API URL. You'll also loop back to Render once
to add Vercel's URL after step 3.

---

## 1. Supabase (database)

1. Create a project at [supabase.com](https://supabase.com) → note the
   database password you set, you'll need it in the connection string.
2. In **Project Settings → Database**, copy the **Connection string**
   under "Connection pooling" (the `pgbouncer` one, port `6543`) — this
   is what Render's long-running Node process should use, since it
   handles connection limits better than the direct connection under
   normal web traffic.
   - It looks like:
     `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true`
3. **Also copy the direct connection string** (port `5432`, no
   `pgbouncer=true`) — you'll need this one locally to run migrations,
   since Prisma's migration engine doesn't work well through the pooler.
4. Locally, push the schema:
   ```bash
   cd apps/backend
   cp .env.example .env
   # paste the DIRECT (5432) connection string into DATABASE_URL for this step
   pnpm prisma:migrate  # or: pnpm exec prisma migrate deploy, for a clean prod push
   ```
5. Seed your first admin login (also runs locally, against the same
   direct connection):
   ```bash
   ADMIN_EMAIL=you@yourdomain.com ADMIN_PASSWORD=choose-something-strong \
     pnpm exec tsx prisma/seed.ts
   ```
6. Keep both connection strings handy — the **pooled** one goes into
   Render's `DATABASE_URL`.

---

## 2. Render (backend API — free tier)

The repo includes `render.yaml` at the root — a Render **Blueprint**
that defines the API service as a **free-tier** web service. The
scheduling itself doesn't happen here (Render's Cron Jobs feature
requires a paid plan) — that's handled for free from Vercel in step 3.

1. Push this repo to GitHub (Render deploys from a Git repo, not a zip
   upload).
2. In the Render dashboard: **New → Blueprint**, connect the repo.
   Render reads `render.yaml` and shows you one service: `runserver-api`
   (free plan).
3. Render will prompt for every env var marked `sync: false` in
   `render.yaml` before creating the service. Fill in:
   - `DATABASE_URL` — Supabase's **pooled** connection string
   - `WEB_APP_URL` — leave as a placeholder for now (e.g.
     `https://placeholder.vercel.app`), you'll update it after step 3
   - `API_URL` — you won't know this until Render assigns the domain;
     come back and fill it in once `runserver-api` is live (Render
     shows it at the top of the service page, e.g.
     `https://runserver-api.onrender.com`)
   - `CRON_SECRET` — make one up (any long random string). You'll set
     the exact same value as `BACKEND_CRON_SECRET` on Vercel in step 3
     — these two must match or the free scheduler can't trigger the jobs
   - `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` — from your Brevo account
   - `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` — from Paystack
   - `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_PUBLIC_KEY` — from Flutterwave
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` — only used if you re-run the seed
     script from Render's shell; safe to leave blank if you already
     seeded locally in step 1
   - `JWT_SECRET`, `ADMIN_JWT_SECRET`, `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
     are set to `generateValue: true` — Render generates strong random
     values for these automatically, nothing to fill in
4. Deploy. Watch the build logs — first build takes a few minutes
   (installs the whole monorepo, generates the Prisma client, compiles
   TypeScript).
5. Once live, hit `https://<your-render-domain>/health` — should return
   `{"ok": true}`. If it doesn't, check the logs; the most common issue
   is `DATABASE_URL` not being the pooled connection string, or a typo
   in one of the required env vars.
6. **Copy the Render URL** — you need it for Vercel next.

**Heads up on the free tier**: Render spins the service down after ~15
minutes of no traffic, and the next request wakes it back up over
30-60 seconds. That's fine for a billing dashboard — a client hitting a
sleeping instance just sees a slightly slow first load, not an error —
and it's specifically accounted for in the cron setup below (the
Vercel function that triggers your jobs is given up to 60s to allow for
exactly this cold start).

---

## 3. Free scheduling: Vercel Cron → Render

Two jobs need to run daily: generating payment requests, and sending
reminders. Render can't schedule them for free, so instead:

**Vercel's Hobby (free) plan includes Cron Jobs — up to 2, daily only —
which happens to be exactly what this app needs.** `apps/web/vercel.json`
already defines both:

```json
{
  "crons": [
    { "path": "/api/cron/generate-requests", "schedule": "0 6 * * *" },
    { "path": "/api/cron/reminders", "schedule": "0 9 * * *" }
  ]
}
```

Each path is a small Next.js API route (`apps/web/app/api/cron/*/route.ts`)
that does nothing but forward the call to your Render backend's
protected `/internal/jobs/*` endpoints — the actual job logic stays in
one place (`apps/backend`), not duplicated into the frontend.

You'll set the two required env vars for this in the Vercel step below
(`CRON_SECRET` and `BACKEND_CRON_SECRET`) — nothing more to do here
until then. If you'd rather not depend on Vercel Cron at all, any free
external pinger works the same way — e.g. [cron-job.org](https://cron-job.org)
hitting `POST https://<render-domain>/internal/jobs/generate-payment-requests`
directly with an `x-cron-secret` header, no Vercel involvement needed.

---

## 4. Vercel (frontend)

1. In Vercel: **Add New → Project**, import the same GitHub repo.
2. Vercel will try to auto-detect a framework at the repo root and get
   it wrong, since this is a monorepo — in **Project Settings → General
   → Root Directory**, set it to `apps/web`. Framework preset should
   then correctly show "Next.js". This is also why `vercel.json` (with
   the cron config) lives inside `apps/web`, not the repo root.
3. Add these environment variables:
   - `NEXT_PUBLIC_API_URL` = the Render URL from step 2
     (e.g. `https://runserver-api.onrender.com`)
   - `CRON_SECRET` = any long random string — this is what Vercel uses
     to authenticate its own cron calls to your API routes (Vercel
     automatically sends it as `Authorization: Bearer <value>` on
     cron-triggered requests)
   - `BACKEND_CRON_SECRET` = the **same value** you set for `CRON_SECRET`
     on Render in step 2. Two different env var names on purpose — one
     authenticates Vercel → your API route, the other authenticates
     your API route → Render — but for simplicity you can just use the
     same string for both if you'd rather manage one secret.
4. Deploy. Vercel gives you a `*.vercel.app` domain immediately;
   attach a custom domain under **Project Settings → Domains** whenever
   you're ready.
5. Confirm the cron jobs registered: **Project Settings → Cron Jobs**
   should list both paths with their schedules. You can trigger either
   manually from that screen to test, rather than waiting for the
   actual scheduled time.

---

## 5. Wire the two back together

Now that both are live:

1. Back in Render, update `runserver-api`'s env vars:
   - `WEB_APP_URL` → your real Vercel URL (or custom domain)
   - `API_URL` → confirm it matches Render's actual assigned domain
   - Redeploy the service (env var changes require a manual redeploy
     or Render's "Restart" — check whether your plan auto-redeploys on
     env var save)
2. This matters because `WEB_APP_URL` is what invite links, password
   reset links, checkout callback URLs, and the email logo image URL
   are all built from — until it's correct, invite emails will point
   at the wrong domain.

---

## 6. Gateway webhooks

Paystack and Flutterwave need to know where to send payment
confirmations:

- **Paystack**: Dashboard → Settings → API Keys & Webhooks → set the
  webhook URL to `https://<your-render-domain>/webhooks/paystack`
- **Flutterwave**: Dashboard → Settings → Webhooks → set the URL to
  `https://<your-render-domain>/webhooks/flutterwave`, and set the
  **Secret Hash** field to the exact same value as
  `FLUTTERWAVE_WEBHOOK_SECRET_HASH` on Render (copy it from Render's
  env var, since it was auto-generated in step 2 — don't regenerate
  it separately in each place, they must match).

---

## 7. Brevo sender verification

Brevo won't send email from a domain you haven't verified. In Brevo:
**Senders & IP → Domains**, add and verify the domain in
`BREVO_SENDER_EMAIL` (SPF/DKIM records via your DNS provider). Until
this is done, invite/reminder/receipt emails will fail or land in spam.

---

## 8. Smoke test

Once everything above is wired:

1. Visit `https://<vercel-domain>/admin/login`, sign in with the admin
   account from the seed script.
2. Create a test client org (`/admin/orgs/new`) — confirm the invite
   email arrives (checks Brevo + `WEB_APP_URL` are correct).
3. Add a service with a `nextDueDate` in the past, so it's immediately
   due rather than waiting for tomorrow's cron.
4. Manually trigger the job instead of waiting for the schedule — either:
   - Vercel dashboard → **Project Settings → Cron Jobs** → run
     `/api/cron/generate-requests` on demand, or
   - `curl -X POST https://<render-domain>/internal/jobs/generate-payment-requests -H "x-cron-secret: <your CRON_SECRET>"`
     directly, bypassing Vercel entirely
   Confirm a `PaymentRequest` shows up for that service.
5. Accept the invite as the test client, log in, check out with a
   Paystack/Flutterwave test card — confirm the webhook fires (check
   Render logs for `runserver-api`) and the payment flips to `PAID`
   with a receipt email sent.
6. Check `/admin/revenue` reflects the test payment.

If every step above works, the same path works for a real client.
