// apps/web/app/robots.ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/login",
          "/forgot-password",
          "/reset-password",
          "/accept-invite",
          "/payment-complete",
          "/api/",
          // client dashboards are per-organization and have no
          // standalone search value: /[org]/dashboard
          "/*/dashboard",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
