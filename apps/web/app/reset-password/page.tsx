// apps/web/app/reset-password/page.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "../../lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (!token) {
      setError("This reset link is missing its token — use the link from your email");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      setDone(true);
      setTimeout(() => router.push("/login"), 1800);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#ECEEF2", fontFamily: "system-ui, sans-serif", background: "#0F1115" }}>
      <div style={{ width: 320, padding: 32, background: "#171A21", border: "1px solid #282D37", borderRadius: 16 }}>
        {done ? (
          <>
            <h1 style={{ fontSize: 18, marginBottom: 8 }}>Password reset</h1>
            <p style={{ color: "#868D99", fontSize: 13 }}>Redirecting you to sign in…</p>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h1 style={{ fontSize: 18, marginBottom: 4 }}>Set a new password</h1>
            <p style={{ color: "#868D99", fontSize: 13, marginBottom: 20 }}>Choose something you haven't used before.</p>

            <label style={{ fontSize: 12, color: "#868D99" }}>New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} style={inputStyle} />

            <label style={{ fontSize: 12, color: "#868D99" }}>Confirm password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} style={inputStyle} />

            {error && <p style={{ color: "#F87171", fontSize: 13, marginTop: -8, marginBottom: 12 }}>{error}</p>}

            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? "Saving…" : "Reset password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", marginTop: 6, marginBottom: 16,
  background: "#0F1115", border: "1px solid #282D37", borderRadius: 8, color: "#ECEEF2", fontSize: 14,
};
const btnStyle: React.CSSProperties = {
  width: "100%", padding: "12px", background: "#E8A33D", color: "#141414",
  border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer",
};
