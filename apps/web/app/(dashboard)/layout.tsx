// apps/web/app/(dashboard)/layout.tsx
import type { Metadata } from "next";

// Client dashboards are per-organization account pages, not public content —
// keep them out of search results even if a URL leaks somewhere.
export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
