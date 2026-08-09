// apps/web/app/admin/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin } from "../../../lib/adminApi";
import Logo from "../../../components/Logo";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminLogin(email, password);
      router.push("/admin/orgs");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#ECEEF2", fontFamily: "system-ui, sans-serif", background: "#0F1115" }}>
      <form onSubmit={handleSubmit} style={{ width: 320, padding: 32, background: "#171A21", border: "1px solid #282D37", borderRadius: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Logo variant="dark" height={28} />
        </div>
        <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "#169DE3", textTransform: "uppercase", marginBottom: 6 }}>
          Admin
        </div>
        <p style={{ color: "#868D99", fontSize: 13, marginBottom: 24 }}>Sign in to manage client organizations.</p>

        <label style={{ fontSize: 12, color: "#868D99" }}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />

        <label style={{ fontSize: 12, color: "#868D99" }}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />

        {error && <p style={{ color: "#F87171", fontSize: 13, marginTop: 4 }}>{error}</p>}

        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
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
