// apps/web/components/InstallPwaBanner.tsx
"use client";

import { useEffect, useState } from "react";

export default function InstallPwaBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setInstalled(true);
      return;
    }

    if (localStorage.getItem("rs_pwa_installed") === "true") {
      setInstalled(true);
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
    }

    function onAppInstalled() {
      localStorage.setItem("rs_pwa_installed", "true");
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setInstalling(false);
    if (outcome === "accepted") {
      localStorage.setItem("rs_pwa_installed", "true");
      setInstalled(true);
    }
    setDeferredPrompt(null);
  }

  if (installed || dismissedThisSession || !deferredPrompt) return null;

  return (
    <div
      style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 100,
        display: "flex", justifyContent: "center", padding: "12px 16px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          display: "flex", alignItems: "center", gap: 12,
          background: "#171A21", border: "1px solid #282D37", borderRadius: 12,
          padding: "10px 12px 10px 16px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          maxWidth: 420, width: "100%",
        }}
      >
        <div
          style={{
            width: 36, height: 36, borderRadius: 8, background: "#0F1115",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, padding: 6, border: "1px solid #282D37",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo/logo-mark-transparent.png"
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#ECEEF2" }}>Install RunServ</div>
          <div style={{ fontSize: 11.5, color: "#868D99" }}>Quick access to your invoices, right from your home screen.</div>
        </div>
        <button
          onClick={handleInstall}
          disabled={installing}
          style={{
            background: "#169DE3", color: "#FFFFFF", border: "none", borderRadius: 8,
            padding: "8px 14px", fontWeight: 600, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          {installing ? "…" : "Install"}
        </button>
        <button
          onClick={() => setDismissedThisSession(true)}
          aria-label="Dismiss"
          style={{ background: "none", border: "none", color: "#868D99", fontSize: 16, cursor: "pointer", padding: 4 }}
        >
          ×
        </button>
      </div>
    </div>
  );
}