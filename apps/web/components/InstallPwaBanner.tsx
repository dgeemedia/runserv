// apps/web/components/InstallPwaBanner.tsx
"use client";

import { useEffect, useState } from "react";

/**
 * Captures the browser's `beforeinstallprompt` event (Chrome/Edge/Android)
 * and shows a sticky bottom banner offering to install the PWA. Unlike a
 * typical dismissible toast, this stays visible across page loads until
 * the app is actually installed — dismissing it only hides it for the
 * current session, it reappears next visit, since the goal is "quick
 * install", not "easy to make go away forever".
 */
export default function InstallPwaBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Already running as an installed PWA — never show the banner.
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setInstalled(true);
      return;
    }

    // Permanent dismissal only happens on successful install, tracked
    // via localStorage so it also stays hidden on future visits.
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
      // `appinstalled` will also fire and persist this, but set it
      // immediately so the banner disappears without waiting on the event.
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
            width: 32, height: 32, borderRadius: 8, background: "#169DE3",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, color: "#FFFFFF", flexShrink: 0, fontSize: 16,
          }}
        >
          R
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
