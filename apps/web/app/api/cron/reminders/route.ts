// apps/web/app/api/cron/reminders/route.ts
import { NextRequest, NextResponse } from "next/server";

// Render's free tier sleeps after ~15 minutes of inactivity; the first
// request after that can take 30-60s to wake it. Extend this function's
// timeout so a cron-triggered cold start doesn't just fail outright.
export const maxDuration = 60;


export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  try {
    const res = await fetch(`${apiUrl}/internal/jobs/send-reminders`, {
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
