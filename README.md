# RunServer

Infrastructure billing for clients — clients sign into their own org
dashboard, check off which services they want to settle, and pay the
combined total in USD in one checkout.

## Structure

```
runserver/
├── apps/
│   ├── backend/              # Express API + Prisma + cron jobs
│   │   ├── prisma/
│   │   │   └── schema.prisma # organizations, users (roles), services,
│   │   │                     # payment_requests, payments, audit_logs
│   │   └── src/
│   │       ├── controllers/  # auth.controller.ts, payments.controller.ts
│   │       ├── middleware/   # auth.middleware.ts (JWT + role guard)
│   │       ├── routes/       # auth.routes.ts, payments.routes.ts
│   │       ├── services/     # email.service.ts (Brevo), paystack.service.ts
│   │       ├── jobs/         # generatePaymentRequests.job.ts, paymentReminders.job.ts
│   │       └── index.ts      # app entry, cron schedules
│   └── web/                  # Next.js dashboard (PWA-enabled)
│       ├── app/
│       │   ├── login/
│       │   └── (dashboard)/[org]/dashboard/
│       ├── lib/api.ts        # backend API client
│       ├── public/manifest.json
│       └── next.config.js    # PWA plugin wired in
├── packages/
│   └── types/                # (placeholder) shared types between web + backend
├── package.json               # pnpm workspace root
└── pnpm-workspace.yaml
```

## Why this shape

- **Monorepo, pnpm workspaces** — one repo, one Prisma schema as the
  single source of truth, no publishing packages back and forth between
  frontend and backend while you're a small team moving fast.
- **Org-scoped accounts, not self-signup** — you (OWNER on your own admin
  side) create each client org and invite their first user. Clients never
  type an "org code" — their email is already scoped to their org, so
  login is just email + password.
- **Roles**: `OWNER` (manage users/services/billing), `FINANCE` (can pay,
  can't manage users), `MEMBER` (view-only by default). This is what lets
  a client add their finance person without giving away full control.
- **Payment requests are generated, not typed in by clients** — a daily
  cron (`generatePaymentRequests.job.ts`) creates the next period's
  invoice line per active service, applying the org's yearly discount
  automatically if that service is billed annually.
- **Payments are gateway-verified, not client-trusted** — the checkout
  flow hands off to Paystack's hosted page; the webhook (HMAC-verified)
  is what actually marks items PAID and fires the receipt email, never
  the browser redirect alone.
- **Brevo powers three emails**: invite (`sendInviteEmail`), due/overdue
  reminders (`sendPaymentReminderEmail`, run daily via
  `paymentReminders.job.ts`), and receipts (`sendReceiptEmail`, fired
  from the webhook handler on successful payment).

## Deploying

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full walkthrough:
**Supabase** (database) → **Render** (backend API, free tier) →
**Vercel** (the Next.js web app, whose free Cron Jobs also drive the
two scheduled billing tasks — no paid cron service needed anywhere).
Covers env var wiring between all three, gateway webhook setup,
Brevo domain verification, and a post-deploy smoke test.

## Setup

```bash
pnpm install

# backend
cp apps/backend/.env.example apps/backend/.env
# fill in DATABASE_URL, JWT_SECRET, ADMIN_JWT_SECRET, BREVO_API_KEY,
# PAYSTACK_SECRET_KEY, FLUTTERWAVE_SECRET_KEY, etc.
pnpm prisma:migrate
pnpm --filter @runserver/backend exec tsx prisma/seed.ts   # creates your first admin login
pnpm dev:backend

# web
pnpm dev:web
```

## Admin side (you, not your clients)

Separate login, separate JWT secret (`ADMIN_JWT_SECRET`), separate
`AdminUser` model — deliberately not reusing the client `User`/`Role`
system, so a bug in org-scoping logic can never grant a client
cross-org or admin access.

- `pnpm --filter @runserver/backend exec tsx prisma/seed.ts` — creates
  your first admin login (reads `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars,
  falls back to placeholders you should immediately change).
- Sign in at `/admin/login` → `/admin/orgs` to see every client.
- **New client** (`/admin/orgs/new`): creates the org and emails its
  first OWNER an invite in one step — the same `inviteUserToOrg` flow
  an org owner uses to add their finance person, just called from the
  admin side instead.
- **Org detail** (`/admin/orgs/:id`): add services with pricing, billing
  cycle, and next due date; pause/reactivate services; see who's on the
  client's team. This is where "Brevo — $45/mo" gets created — it then
  shows up as a checkbox on that client's dashboard once the daily cron
  turns it into a `PaymentRequest`.
- Yearly discount % and preferred gateway (Paystack/Flutterwave) are set
  per-org here too, editable via `PATCH /admin/orgs/:orgId`.

## Multi-gateway (Paystack + Flutterwave)

Both gateways sit behind a shared `GatewayAdapter` interface
(`src/services/gateways/gateway.types.ts`). The controller never talks
to Paystack or Flutterwave directly — it calls `getGateway(org.preferredGateway)`
and everything else (checkout creation, webhook handling, fulfillment)
is identical regardless of which one an org is on. Concretely:

- `paystack.adapter.ts` / `flutterwave.adapter.ts` — each implements
  `initializeTransaction`, `verifyTransaction`, `verifyWebhookSignature`,
  and two small webhook-parsing helpers.
- Two webhook routes (`/webhooks/paystack`, `/webhooks/flutterwave`)
  both funnel into the same `handleGatewayWebhook` → `fulfillVerifiedPayment`
  path, so there's exactly one place that marks a payment SUCCESS and
  sends the receipt — not one per gateway.
- Switching an org from one gateway to the other is a single `PATCH`,
  with zero code changes.
- Note Flutterwave's webhook auth is a static `verif-hash` header
  comparison (`FLUTTERWAVE_WEBHOOK_SECRET_HASH`), not an HMAC like
  Paystack's — set that hash to match what you configure in their
  dashboard.

## Shared types (`@runserver/types`)

`packages/types/src/index.ts` is the single source of truth for enums
(`OrgRole`, `ServiceCategory`, `PaymentGateway`, etc.) and the DTOs
crossing the API boundary (`LoginResponse`, `CreateOrganizationRequest`,
etc.). Both `apps/backend` and `apps/web` depend on it via
`workspace:*`; Next.js is configured with `transpilePackages` since it's
raw TS, not a pre-built dist. A schema/contract change here is a
TypeScript error in both apps immediately, not a runtime surprise.

## PWA icons

Real icons live in `apps/web/public/icons/` (192, 512, a maskable 512
for Android's adaptive-icon shapes, and an Apple touch icon) — amber "R"
monogram on the app's dark background, matching the dashboard's palette.
Regenerate them from `packages design/branding` if you want a different
mark later; the manifest and `layout.tsx` already reference all four.

## Fixed: org resolution no longer trusts localStorage

Previously the client dashboard read `orgId` from `localStorage`, set once
at login. That meant a stale bookmark, a shared/public device, or someone
hand-editing the `/[org]/dashboard` URL slug could — in theory — end up
requesting data under the wrong org id if the two ever drifted apart.

Now:
- **`GET /orgs/resolve/:slug`** takes the slug straight from the URL and
  resolves it to a real org server-side, then checks that org's id
  against the `orgId` already encoded in the caller's JWT. Mismatch →
  `403`, not silently served. `localStorage` is only used to hold the
  token now, never an org id.
- **`requireMatchingOrgParam`** (new middleware) is applied to every
  `/orgs/:orgId/...` route. Previously the `:orgId` in those URLs was
  decorative — controllers already scoped queries to `req.user.orgId`
  from the token, so no cross-org data leak was possible, but a
  mismatched URL and token would silently just serve the token's org
  instead of erroring. Now it's an explicit `403` if the two disagree.
- The dashboard (`app/(dashboard)/[org]/dashboard/page.tsx`) now has
  explicit states for `unauthenticated` (redirect to `/login`),
  `forbidden` (signed in, but wrong org — prompts to switch accounts),
  and `not-found`, instead of assuming the happy path.

## FX rate: seeing the raw quote before any margin is applied

`/admin/settings` now has two explicit steps instead of one "sync" button:

1. **Preview** (`GET /admin/fx-rate/preview`) — fetches live quotes from
   two independent providers (open.er-api.com and exchangerate-api.com)
   and shows both raw numbers plus their average, with **zero markup
   applied** and **nothing saved**. Using two sources matters: any
   single free-tier FX API can occasionally return a stale or wrong
   number, and this is the number your margin sits on top of — worth a
   sanity check against a second source before trusting it.
2. **Apply** — you pick a number (either provider's quote, the average,
   or hand-typed) into "Market rate", set your markup %, and hit
   "Save rate" as a distinct, deliberate action. The form shows a live
   preview of the resulting effective rate before you save.

On what "widely accepted" means in practice for USD/NGN: there isn't one
single official real-time rate the way there is for listed equities —
free aggregator APIs (what's wired in here) are a reasonable default
starting reference, but they can lag the market. Two things worth doing
as you get real volume:
- **Cross-check against the CBN's published NAFEX/official rate** when
  you set your markup — it's the reference Nigerian businesses and
  clients are most likely to recognize as "fair," so pricing far off it
  (even with a legitimate markup for your card-payment costs) is more
  likely to prompt questions.
- **Consider using Paystack's/Flutterwave's own settlement rate as your
  anchor instead of a third-party quote**, once you're processing real
  volume — that's literally the rate you'll be converting at when their
  NGN collections land in your account, arguably more relevant than any
  external aggregator.

The backend also still exposes `POST /admin/fx-rate/sync` (saves
directly, no preview step) — useful if you later want a daily cron to
auto-refresh `marketRate` unattended, while still leaving `markupPct`
untouched since that's always your manual decision.

## Genuinely still open

- No password-reset flow existed before — **now added**: see below.
- No cross-client revenue view existed before — **now added**: see below.
- No admin UI to deactivate an org or user — **now added**: see below.
- Real-time push notifications for payment reminders (currently email-only via Brevo).
- A proper `:org` slug → `orgId` resolution endpoint — the client dashboard
  currently reads `orgId` from `localStorage` (set at login) rather than
  resolving it from the URL slug on each load. Fine for now, worth
  hardening before this is public-facing at scale.

## Revenue, password reset, and admin deactivation (latest additions)

**Cross-client revenue** — `GET /admin/revenue`, surfaced at `/admin/revenue`.
Aggregates every `SUCCESS` payment by the canonical `usdAmount` field (not
the charged `amount`), so USD and NGN payments roll into one comparable
total. Breaks down by client, by gateway, and by currency, plus a recent-
payments feed. Because conversion happens once at checkout and `usdAmount`
is stored permanently on the `Payment` row, this stays accurate even if
you change the FX markup later — historical payments aren't retroactively
recalculated.

**Forgot/reset password** — `POST /auth/forgot-password` always returns
the same generic message regardless of whether the email exists (prevents
account enumeration). It creates a `PASSWORD_RESET`-typed `InviteToken`
(same model as invites, different `type`, 1-hour expiry instead of 48h)
and emails a reset link via Brevo. `POST /auth/reset-password` consumes
it — explicitly checks `type === "PASSWORD_RESET"` so an old invite link
can never double as a password-reset link. Frontend: `/forgot-password`
and `/reset-password`, linked from the login page.

**Admin deactivation** — `PATCH /admin/orgs/:orgId` (`isActive`) and
`PATCH /admin/orgs/:orgId/users/:userId` (`isActive`) were already
API-complete; the org detail admin page now has the buttons wired to
them. Deactivating an org blocks every user in it from logging in
(checked in `requireAuth`); deactivating one user blocks just them,
useful when someone leaves the client's company but the org stays active.

## Persistent PWA install prompt

`components/InstallPwaBanner.tsx`, mounted in the root layout so it's
present on every client-facing page. It listens for the browser's
`beforeinstallprompt` event and shows a sticky bottom banner rather than
a one-off toast. Dismissing it hides it for that session only — it
reappears on the next visit — and it disappears permanently only once
`appinstalled` actually fires (tracked in `localStorage`, and also
skipped entirely if the app detects it's already running in standalone/
installed mode). Note this event is Chrome/Edge/Android-only; iOS Safari
has no equivalent API, so there's no install banner shown there — the
Apple touch icon + manifest still make manual "Add to Home Screen"
work, just without a prompt.

## Dual currency: USD + NGN, with an admin-configurable markup

Every service is still priced canonically in **USD** — that never
changes, and `PaymentRequest.amount` is always USD. What's new is a
currency toggle at checkout:

- **`ExchangeRate` model** stores a `marketRate` (₦ per $1) and your
  `markupPct`. The rate actually charged is always
  `marketRate × (1 + markupPct / 100)`, computed fresh on every request
  in `fx.service.ts` — there's exactly one formula, one place, so
  changing your margin is a single field edit.
- **Admin controls it** at `/admin/settings`: edit the market rate by
  hand, or hit "Sync latest market rate" to pull from a free public API
  (`open.er-api.com`) — that only touches `marketRate`, never
  `markupPct`, since your margin is a business decision, not a market
  fact.
- **Client picks currency at checkout**: the dashboard shows a USD/NGN
  toggle; selecting NGN shows the converted total (with the USD
  equivalent underneath for clarity) before they proceed. The actual
  gateway transaction is created in whichever currency they picked.
- **Every payment stores both values**: `Payment.amount` +
  `Payment.currency` is what was actually charged, `Payment.usdAmount`
  is the canonical USD figure, and `Payment.fxRateApplied` records the
  exact rate used (null for USD payments) — so a payment made in NGN
  six months ago still shows the rate that was live at that moment,
  not today's.
- Both gateway adapters (Paystack, Flutterwave) now take a generic
  `{ amount, currency }` rather than an assumed USD — switching what
  currency an org's clients can pay in required zero gateway-specific
  code changes, same as switching gateways did.
