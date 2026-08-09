// apps/web/app/forgot-password/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "../../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true); // always shows success, even if the email doesn't exist
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#ECEEF2", fontFamily: "system-ui, sans-serif", background: "#0F1115" }}>
      <div style={{ width: 320, padding: 32, background: "#171A21", border: "1px solid #282D37", borderRadius: 16 }}>
        {sent ? (
          <>
            <h1 style={{ fontSize: 18, marginBottom: 8 }}>Check your email</h1>
            <p style={{ color: "#868D99", fontSize: 13, lineHeight: 1.5 }}>
              If an account exists for <strong>{email}</strong>, we've sent a link to reset your password.
              It expires in 1 hour.
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h1 style={{ fontSize: 18, marginBottom: 4 }}>Forgot password</h1>
            <p style={{ color: "#868D99", fontSize: 13, marginBottom: 20 }}>
              We'll email you a link to reset it.
            </p>

            <label style={{ fontSize: 12, color: "#868D99" }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />

            {error && <p style={{ color: "#F87171", fontSize: 13, marginTop: 4 }}>{error}</p>}

            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link href="/login" style={{ display: "block", marginTop: 16, fontSize: 12.5, color: "#868D99", textAlign: "center" }}>
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", marginTop: 6, marginBottom: 16,
  background: "#0F1115", border: "1px solid #282D37", borderRadius: 8, color: "#ECEEF2", fontSize: 14,
};
const btnStyle: React.CSSProperties = {
  width: "100%", padding: "12px", background: "#169DE3", color: "#FFFFFF",
  border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer",
};
