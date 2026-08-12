// apps/backend/src/lib/env.ts

// ------------------------------------------------------------------
// WEB_APP_URL can be a comma-separated list (e.g.
// "https://runserv.org,https://www.runserv.org") because the CORS
// allowlist needs every origin that's allowed to call the API.
//
// But anything that builds a single outbound link or asset URL — an
// invite link, a password reset link, the logo <img src> in emails —
// must NOT just interpolate process.env.WEB_APP_URL directly, or you
// get a broken concatenated string like:
//   "https://runserv.org,https://www.runserv.org/accept-invite?token=..."
//
// canonicalAppUrl() is the single source of truth for that case: it
// takes the first entry in the list as "the" app URL. Set
// WEB_APP_URL with your canonical domain listed first
// (e.g. "https://runserv.org,https://www.runserv.org" if runserv.org
// is canonical) so links/logos always point to the right place
// regardless of how many origins CORS allows.
// ------------------------------------------------------------------
export function canonicalAppUrl(): string {
  const raw = process.env.WEB_APP_URL ?? "";
  const first = raw.split(",")[0]?.trim();
  if (!first) {
    throw new Error("WEB_APP_URL is not set — cannot build links/assets for outbound email");
  }
  return first;
}