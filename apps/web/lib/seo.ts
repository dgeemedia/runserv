// apps/web/lib/seo.ts
//
// Single source of truth for the canonical production URL.
// IMPORTANT: replace the fallback below with your real domain (or set
// NEXT_PUBLIC_SITE_URL in your deployment env) before shipping — every
// canonical link, sitemap entry, and Open Graph URL is derived from this.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://runserv.org").replace(/\/$/, "");

export const SITE_NAME = "RunServ";
