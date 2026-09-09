// apps/web/app/accept-invite/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accept invite",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
