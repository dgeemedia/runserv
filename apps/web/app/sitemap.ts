// apps/web/app/sitemap.ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/seo";

// Only public, content-bearing marketing pages belong here. Client
// dashboards, the admin panel, auth flows, and API routes are
// per-account or functional, not something a search engine should index —
// they're kept out of the sitemap and blocked in robots.ts instead.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/agency-signup`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
