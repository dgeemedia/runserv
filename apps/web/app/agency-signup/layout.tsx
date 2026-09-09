// apps/web/app/agency-signup/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Start billing your clients — Agency sign-up",
  description:
    "Create your RunServ agency account and start invoicing clients for infrastructure costs — hosting, APIs, databases — from one dashboard.",
  alternates: {
    canonical: "/agency-signup",
  },
};

export default function AgencySignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
