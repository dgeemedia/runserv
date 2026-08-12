// apps/web/app/accept-invite/page.tsx
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { acceptInvite } from "../../lib/api";
import Logo from "../../components/Logo";

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <StatusScreen>
          <p style={{ color: "#868D99", fontSize: 13 }}>Loading…</p>
        </StatusScreen>
      }
    >
      <AcceptInviteForm />
    </Suspense>
  );
}

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("This invite link is missing its token — ask for a new invite.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await acceptInvite(token, password);
      setDone(true);
      // Brief pause so the confirmation is visible before redirecting.
      setTimeout(() => router.push("/login"), 1500);
    } catch (err: any) {
      setError(err.message || "Could not set your password. The link may have expired.");
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <StatusScreen>
        <p style={{ marginBottom: 4, color: "#F87171" }}>This invite link is invalid.</p>
        <p style={{ color: "#868D99", fontSize: 13, marginBottom: 16 }}>
          No token was found in the URL. Ask whoever invited you to resend it.
        </p>
        <button onClick={() => router.push("/login")} style={btnStyle}>
          Go to sign in
        </button>
      </StatusScreen>
    );
  }

  if (done) {
    return (
      <StatusScreen>
        <p style={{ marginBottom: 4 }}>Password set.</p>
        <p style={{ color: "#868D99", fontSize: 13 }}>Redirecting you to sign in…</p>
      </StatusScreen>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0F1115",
        color: "#ECEEF2",
        fontFamily: "system-ui, sans-serif",
        padding: 20,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 360,
          background: "#171A21",
          border: "1px solid #282D37",
          borderRadius: 12,
          padding: 32,
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <Logo variant="dark" height={22} />
        </div>
        <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Set your password</h1>
        <p style={{ color: "#868D99", fontSize: 13, margin: "0 0 24px" }}>
          Choose a password to finish setting up your account.
        </p>

        <label style={labelStyle}>New password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          autoFocus
          required
        />

        <label style={{ ...labelStyle, marginTop: 14 }}>Confirm password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={inputStyle}
          required
        />

        {error && (
          <p style={{ color: "#F87171", fontSize: 13, marginTop: 14, marginBottom: 0 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{ ...btnStyle, width: "100%", marginTop: 20, opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? "Setting password…" : "Set password & continue"}
        </button>
      </form>
    </div>
  );
}

function StatusScreen({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        color: "#ECEEF2",
        fontFamily: "system-ui, sans-serif",
        background: "#0F1115",
        textAlign: "center",
        padding: 20,
      }}
    >
      {children}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  color: "#868D99",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0F1115",
  border: "1px solid #282D37",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#ECEEF2",
  fontSize: 14,
  boxSizing: "border-box",
};

const btnStyle: React.CSSProperties = {
  background: "#169DE3",
  color: "#FFFFFF",
  border: "none",
  borderRadius: 8,
  padding: "10px 18px",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 14,
};