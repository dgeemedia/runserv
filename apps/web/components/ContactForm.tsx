// apps/web/components/ContactForm.tsx
"use client";

import { useState } from "react";
import { submitContactEnquiry } from "../lib/api";

const TOPICS = ["General enquiry", "Agency sign-up", "Support", "Partnership / press"];

const inputStyle: React.CSSProperties = {
  width: "100%", background: "#0F1115", border: "1px solid #282D37", borderRadius: 8,
  padding: "11px 12px", color: "#ECEEF2", fontSize: 14, fontFamily: "inherit", outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12.5, color: "#868D99", marginBottom: 6, fontWeight: 500,
};

export default function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as any;

    try {
      await submitContactEnquiry(data);
      setStatus("sent");
      form.reset();
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message || "Something went wrong. Please try again.");
    }
  }

  if (status === "sent") {
    return (
      <div
        style={{
          background: "#171A21", border: "1px solid #282D37", borderRadius: 14,
          padding: "40px 24px", textAlign: "center",
        }}
      >
        <div
          style={{
            width: 44, height: 44, borderRadius: 12, background: "#0F1115", border: "1px solid #282D37",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            fontSize: 18, color: "#4ADE80",
          }}
        >
          ✓
        </div>
        <div style={{ fontSize: 16, color: "#ECEEF2", fontWeight: 600, marginBottom: 6 }}>Message sent</div>
        <p style={{ fontSize: 14, color: "#868D99", margin: 0 }}>
          Thanks for reaching out — we'll get back to you soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Honeypot — hidden from real visitors via CSS, bots tend to fill every field */}
      <input
        type="text"
        name="hp_website"
        tabIndex={-1}
        autoComplete="off"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
        aria-hidden="true"
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required maxLength={200} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required maxLength={200} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="company">Company (optional)</label>
          <input id="company" name="company" type="text" maxLength={200} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="topic">Topic</label>
          <select id="topic" name="topic" style={inputStyle} defaultValue={TOPICS[0]}>
            {TOPICS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle} htmlFor="message">Message</label>
        <textarea
          id="message" name="message" required minLength={10} maxLength={5000} rows={6}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      {status === "error" && (
        <p style={{ fontSize: 13.5, color: "#F87171", margin: 0 }}>{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        style={{
          background: status === "sending" ? "#282D37" : "#169DE3",
          color: status === "sending" ? "#868D99" : "#FFFFFF",
          border: "none", borderRadius: 10, padding: "13px 24px", fontWeight: 600,
          fontSize: 15, cursor: status === "sending" ? "default" : "pointer",
          transition: "background 0.15s ease", alignSelf: "flex-start",
        }}
      >
        {status === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
