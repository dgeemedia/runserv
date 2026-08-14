// apps/web/app/payment-complete/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaymentCompletePage() {
  const router = useRouter();

  useEffect(() => {
    const slug = localStorage.getItem("rs_return_org_slug");
    localStorage.removeItem("rs_return_org_slug");
    const timer = setTimeout(() => {
      router.push(slug ? `/${slug}/dashboard` : "/login");
    }, 1500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#ECEEF2", background: "#0F1115", fontFamily: "system-ui, sans-serif" }}>
      <p>Finishing up — redirecting you back to your invoices…</p>
    </div>
  );
}