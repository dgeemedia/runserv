// apps/web/app/api/cron/generate-requests/route.ts
import { NextRequest, NextResponse } from "next/server";

// Render's free tier sleeps after ~15 minutes of inactivity; the first
// request after that can take 30-60s to wake it. Extend this function's
// timeout so a cron-triggered cold start doesn't just fail outright.
export const maxDuration = 60;


/**
 * Vercel's free (Hobby) plan includes Cron Jobs — up to 2, daily only —
 * which is exactly what this app needs and costs nothing. Vercel calls
 * this route on schedule (see vercel.json); this route's only job is to
 * forward the call to the backend with the shared secret, since the
 * actual job logic lives in one place (apps/backend) rather than being
 * duplicated here.
 *
 * Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` on
 * cron-triggered requests when CRON_SECRET is set as a Vercel env var —
 * checked below so this route can't be triggered by anyone who finds
 * the URL.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  try {
    const res = await fetch(`${apiUrl}/internal/jobs/generate-payment-requests`, {
      method: "POST",
      headers: { "x-cron-secret": process.env.BACKEND_CRON_SECRET || "" },
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `Backend job failed: ${body}` }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Could not reach backend" }, { status: 502 });
  }
}
