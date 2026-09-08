# RunServ Multi-Tenant Upgrade — Implementation Notes

This documents what was actually changed in this codebase, and the exact
steps to get it running. Read this before deploying — a few things need
your input and can't be safely automated.

## What changed (by file)

| File | Change |
|---|---|
| `prisma/schema.prisma` | New `Tenant`, `TenantType`, `TenantFeeModel`, `TenantStatus`, `PlatformFeeLedger` models. `Organization`, `AdminUser`, `Payment`, `ExchangeRate` now belong to a `Tenant`. |
| `src/middleware/admin.middleware.ts` | `requireAdminAuth` now resolves and attaches the admin's tenant (`req.admin.tenantId`, `req.admin.isPlatformAdmin`). New `requirePlatformAdmin` gate for platform-only routes. |
| `src/controllers/admin.auth.controller.ts` | Login response now includes tenant info. |
| `src/controllers/admin.orgs.controller.ts` | Every org/service/user lookup now checks the org's `tenantId` matches the calling admin's tenant (unless platform admin). Slug uniqueness is now per-tenant. |
| `src/controllers/admin.payments.controller.ts` | Same tenant check added to `resyncPayment` and `markPaymentsPaidManually`; manual payments now carry `tenantId`. |
| `src/controllers/admin.email.controller.ts` | Same tenant check added to `resendInvite`, `resendReceipt`, `sendMessageToOrg`. |
| `src/controllers/admin.revenue.controller.ts` | Revenue is now scoped to the calling admin's tenant; platform admins see cross-tenant totals plus RunServ's own fee income. |
| `src/services/fx.service.ts` | FX markup (`markupPct`) is now per-tenant. `marketRate` stays platform-wide (sourced from the PLATFORM tenant's row) so every tenant's NGN pricing tracks the same underlying rate. |
| `src/controllers/admin.fx.controller.ts` | Agency tenants can set their own `markupPct`; only platform admins can set `marketRate` or trigger a live sync. |
| `src/services/gateways/gateway.types.ts` | `InitTransactionParams` gained an optional `split` (tenant sub-account + platform fee). |
| `src/services/gateways/flutterwave.adapter.ts` | Passes `subaccounts` to Flutterwave's `/payments` endpoint when a split is present. **Needs verification against Flutterwave's current docs before going live — see Open Questions below.** |
| `src/lib/platformFee.ts` | New. Computes RunServ's cut of a transaction from the tenant's fee model. |
| `src/controllers/payments.controller.ts` | Checkout now: resolves the org's tenant, computes the platform fee, requests a split payment when the tenant has a connected Flutterwave sub-account, and snapshots `platformFeeUsd` onto the `Payment`. Fulfillment now writes a `PlatformFeeLedger` row. |
| `src/controllers/tenant.controller.ts` | **New.** Self-serve tenant signup, Flutterwave sub-account connection, tenant self-service settings, and platform-only tenant management (list, update fee model/status). |
| `src/routes/tenant.routes.ts` | **New.** Routes for the above. |
| `src/server.ts` | Mounts `tenant.routes.ts`; rate-limits the new public signup endpoint. |
| `prisma/seed.ts` | Now creates a `PLATFORM` tenant before the first admin user. **Only for a brand-new empty database — see next section for your actual data.** |
| `src/scripts/migrateToTenants.ts` | **New.** One-off script to backfill your existing single-tenant data (your 3 clients) onto a `PLATFORM` tenant. |

## Steps to actually deploy this

Do these in order, against a **staging/dev database first**, not production.

### 1. Install and validate

```bash
cd apps/backend
pnpm install
npx prisma format --schema=prisma/schema.prisma   # catches syntax issues
npx prisma validate --schema=prisma/schema.prisma
```

I could not run these last two myself — this sandbox's network doesn't reach
Prisma's binary CDN. Run them yourself before continuing; if `validate` finds
anything, fix it before touching your real database.

### 2. Generate and apply the migration

Because `tenantId` is a required (`NOT NULL`) field on tables that already
have data (`Organization`, `AdminUser`, `Payment`, `ExchangeRate`), a plain
`prisma migrate dev` will refuse to apply if you have existing rows — it
can't invent a `tenantId` for them. Two options:

**Option A (recommended) — two-phase migration:**
1. Temporarily mark the new `tenantId` columns as optional (`String?`) in the schema, generate + apply that migration.
2. Run `pnpm exec tsx src/scripts/migrateToTenants.ts` to backfill every existing row onto a new `PLATFORM` tenant.
3. Change `tenantId` back to required (`String`) in the schema, generate + apply a second migration now that every row has a value.

**Option B** — if your dataset is genuinely small (your 3 clients), it may
be faster to export the data, wipe the dev database, apply the full schema
fresh, then re-import — but this is riskier for anything with real payment
history you care about. Option A is safer.

```bash
npx prisma migrate dev --name add_tenants
```

### 3. Seed or migrate

- **Fresh/empty database:** `pnpm exec tsx prisma/seed.ts`
- **Your existing data (3 real clients):** `pnpm exec tsx src/scripts/migrateToTenants.ts` — do NOT run `seed.ts` against this database, it assumes an empty one.

### 4. Set your tenant's fee model

Your own tenant (`type: PLATFORM`) doesn't need a fee model — it's you, not
a customer of the platform. When you onboard your first real agency tenant
(via `POST /tenants/signup`), set their fee model explicitly rather than
leaving the schema default:

```bash
curl -X PATCH https://your-api/admin/platform/tenants/:tenantId \
  -H "Authorization: Bearer <platform admin token>" \
  -H "Content-Type: application/json" \
  -d '{"feeModel": "TRANSACTION_PCT", "feePct": 3}'
```

### 5. Frontend changes — not yet done

`apps/web` was not touched. It still assumes a single-tenant admin login
and will not show tenant-aware UI (tenant settings page, Flutterwave
connect flow, platform tenant list) until it's updated to call the new
`/admin/tenant*` and `/admin/platform/tenants*` endpoints. This is the
next chunk of work — happy to do it once you've confirmed the backend
migration went cleanly in your dev environment.

## Update — This pass (bug fixes + audit log)

Since you already migrated your database in the previous pass, this adds
**one more schema change** — a new `PlatformAuditLog` table — plus fixes to
the split-payment logic. Run this against your dev database:

```bash
cd apps/backend
npx prisma migrate dev --name add_platform_audit_log
```

Nothing else needs backfilling — this migration only adds a new empty
table, it doesn't touch existing columns.



- **Flutterwave split-payment fields — fixed, but still verify with a real sandbox transaction.**
  I initially used `transaction_charge_type: "flat_subaccount"` / `transaction_charge`, but Flutterwave's own documentation describes this pair inconsistently across pages — one says the subaccount *keeps* that amount, another says the subaccount is *charged* it and the main account keeps the rest. Rather than guess on money-routing, I switched to `split_type: "percentage"` / `split_value`, which every source agrees means "this % is the main account's (RunServ's) commission, the remainder settles to the subaccount." This is now in `flutterwave.adapter.ts`. **Still test with a real (sandbox-mode) Flutterwave transaction before your first live split** — a percentage split is unambiguous in the docs, but I have not executed one against Flutterwave's actual API from this environment.
- **Bug found and fixed: FLAT_SUBSCRIPTION tenants were not getting split payments at all.** Because their per-transaction platform fee computes to $0, the original code skipped building a `split` object entirely — which meant the *whole* transaction amount would have gone to RunServ's main Flutterwave account instead of the tenant's. Fixed: a split is now always sent for any AGENCY tenant with a connected sub-account, with `platformSplitPct: 0` when no per-transaction fee applies, so the tenant always gets the correct share. If you already onboarded a real FLAT_SUBSCRIPTION tenant before this fix, check their settled transactions.
- **Paystack split payments are not implemented.** `flutterwave.adapter.ts` handles splitting; `paystack.adapter.ts` does not. Right now, if an agency tenant's org has `preferredGateway: PAYSTACK`, their checkout will **not** split — the whole amount goes to RunServ's main Paystack account and nothing settles to the tenant automatically. Either restrict agency tenants to Flutterwave for now (simplest), or implement Paystack's subaccount API in `paystack.adapter.ts` before allowing agencies to choose Paystack.
- **Platform rule changes are now audited.** Every fee-model/rate/status change made via `/admin/platform/tenants/:tenantId` is recorded to a new `PlatformAuditLog` table (before/after snapshot, who made the change). Retrievable via `GET /admin/platform/tenants/:tenantId/audit-log`. No frontend UI for viewing this yet — it's API-only for now.
- **Fee model on first transaction after signup.** A newly signed-up tenant has `feeModel: TRANSACTION_PCT, feePct: 3` (schema defaults) until a platform admin changes it. Decide if that's the real default you want publicly, or if it should require explicit configuration before a tenant can go ACTIVE.
- **FX_SPREAD_SHARE math** in `src/lib/platformFee.ts` currently takes `feePct` as a share of the *tenant's whole FX markup*, not a percentage of RunServ's platform-level markup. Re-read the comment in that file before enabling this fee model for a real tenant — the exact split math is the one thing in this upgrade most likely to need a business decision, not just a code change.

## What's still genuinely open from our earlier conversation

- Frontend/admin UI for the new tenant flows (Section 5 above).
- A real "developers' app of choice" outcome depends on onboarding real
  agencies and iterating on friction they hit — no code change accomplishes
  this by itself.

## Update — Frontend (this pass)

The frontend is now built out. What changed:

| File | Change |
|---|---|
| `packages/types/src/index.ts` | Added `Tenant`, `TenantType`, `TenantFeeModel`, `TenantStatus`, and request/response types for signup, tenant self-service, and platform tenant management. `AdminLoginResponse` now includes `tenant`. |
| `apps/web/lib/adminApi.ts` | New functions: `signupTenant`, `getMyTenant`, `updateMyTenant`, `connectFlutterwaveSubaccount`, `listPlatformTenants`, `updatePlatformTenant`, `getCachedTenant`. Login now caches tenant info in `localStorage` (`rs_admin_tenant`) so the nav can render without an extra round-trip. |
| `apps/web/components/AdminNav.tsx` | Shows the tenant name next to "Admin", and a **Platform** nav item — only visible when the logged-in admin's tenant is `PLATFORM`. |
| `apps/web/app/admin/settings/page.tsx` | Agency admins can now only edit their own `markupPct`; the underlying market rate (and the live-quote preview used to set it) is platform-admin-only, matching the backend's 403. |
| `apps/web/app/admin/tenant/page.tsx` | **New.** Every tenant's self-service page: profile (name, support email), Flutterwave sub-account connection with a live status banner (pending/active/suspended), and a read-only view of their billing terms. |
| `apps/web/app/admin/platform/tenants/page.tsx` | **New — this is the dashboard you asked for.** Platform-only. Lists every agency tenant with client/payment counts and Flutterwave connection status; expand a row to set that tenant's **status** (pending/active/suspended), **fee model** (transaction %, FX spread share %, or flat monthly $), and rate — this is the single place these rules are set platform-wide. |
| `apps/web/app/agency-signup/page.tsx` | **New.** Public self-serve signup for a new agency — creates the tenant + first admin, then routes to `/admin/tenant` to connect Flutterwave. Linked from the admin login page. |
| `apps/web/app/admin/revenue/page.tsx` | Platform admins now see a "RunServ platform fees earned" stat card alongside gross revenue. |

### Verified in this sandbox

- `npx tsc --noEmit` — clean, no type errors across the frontend.
- `npx next build` — full production build succeeds; all new routes
  (`/admin/platform/tenants`, `/admin/tenant`, `/agency-signup`) compile and
  prerender correctly alongside the existing ones.
- I could **not** verify against your live backend (no running API in this
  sandbox) — do a manual click-through in your dev environment before
  trusting this in production: log in as your existing platform admin,
  confirm the nav shows the Platform link, open a tenant's rules, save a
  change, and confirm it reflects on that tenant's own `/admin/tenant` page.

### One real decision left for you

The platform dashboard lets you set **any** agency's fee model and rate,
including down to 0%. There's no floor or approval step — nothing stops you
(or, once you add more platform staff, them) from accidentally zeroing out
your own revenue on a tenant. If that's a real risk once more than one
person has platform access, worth adding a confirmation step or an audit
log entry on `updateTenantAsPlatform` before it's a problem rather than
after.

