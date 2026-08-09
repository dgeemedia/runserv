// apps/web/components/MarkdownComposer.tsx
"use client";

import { useRef, useState } from "react";
import { marked } from "marked";
import { Bold, Italic, Link as LinkIcon, List } from "lucide-react";

interface MarkdownComposerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

/**
 * A lightweight Markdown editor: toolbar buttons insert syntax at the
 * cursor rather than requiring the admin to know Markdown by hand, and
 * a Preview tab renders it client-side so what you see is close to
 * what the recipient gets. The actual sent email is rendered and
 * sanitized server-side independently (see email.service.ts) — this
 * preview is a convenience, not the source of truth for what's safe.
 */
export default function MarkdownComposer({ value, onChange, placeholder, rows = 8 }: MarkdownComposerProps) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function wrapSelection(before: string, after: string = before) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const selected = value.slice(selectionStart, selectionEnd);
    const next = value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = selectionStart + before.length;
      el.selectionEnd = selectionStart + before.length + selected.length;
    });
  }

  function insertLinePrefix(prefix: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = selectionStart + prefix.length;
      el.selectionEnd = selectionEnd + prefix.length;
    });
  }

  function insertLink() {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const selected = value.slice(selectionStart, selectionEnd) || "link text";
    const markup = `[${selected}](https://)`;
    const next = value.slice(0, selectionStart) + markup + value.slice(selectionEnd);
    onChange(next);
    // Place cursor inside the (https://) so the admin can type the real URL immediately
    const urlStart = selectionStart + selected.length + 3;
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = urlStart;
      el.selectionEnd = urlStart + 8;
    });
  }

  const previewHtml = tab === "preview" ? (marked.parse(value || "*Nothing to preview yet.*", { async: false, gfm: true, breaks: true }) as string) : "";

  return (
    <div style={{ border: "1px solid #282D37", borderRadius: 8, overflow: "hidden" }}>
      {/* Tabs + toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0F1115", borderBottom: "1px solid #282D37", padding: "6px 8px" }}>
        <div style={{ display: "flex", gap: 2 }}>
          <TabButton active={tab === "write"} onClick={() => setTab("write")}>Write</TabButton>
          <TabButton active={tab === "preview"} onClick={() => setTab("preview")}>Preview</TabButton>
        </div>
        {tab === "write" && (
          <div style={{ display: "flex", gap: 2 }}>
            <ToolButton title="Bold" onClick={() => wrapSelection("**")}><Bold size={14} /></ToolButton>
            <ToolButton title="Italic" onClick={() => wrapSelection("*")}><Italic size={14} /></ToolButton>
            <ToolButton title="Link" onClick={insertLink}><LinkIcon size={14} /></ToolButton>
            <ToolButton title="Bulleted list" onClick={() => insertLinePrefix("- ")}><List size={14} /></ToolButton>
          </div>
        )}
      </div>

      {/* Write */}
      {tab === "write" && (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          style={{
            width: "100%", padding: "12px 14px", background: "#171A21", border: "none",
            color: "#ECEEF2", fontSize: 13.5, fontFamily: "inherit", resize: "vertical", outline: "none",
          }}
        />
      )}

      {/* Preview — rendered with the same visual weight as the sent email */}
      {tab === "preview" && (
        <div
          style={{ padding: "16px 18px", background: "#ffffff", color: "#333", minHeight: rows * 22, fontSize: 14 }}
          className="rs-md-preview"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      )}
      <style>{`
        .rs-md-preview p { margin: 0 0 12px; line-height: 1.6; }
        .rs-md-preview a { color: #0B6FAE; }
        .rs-md-preview ul, .rs-md-preview ol { margin: 0 0 12px; padding-left: 20px; }
        .rs-md-preview li { margin-bottom: 4px; }
        .rs-md-preview strong { font-weight: 700; }
        .rs-md-preview blockquote { border-left: 3px solid #169DE3; margin: 0 0 12px; padding-left: 12px; color: #555; }
      `}</style>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 12px", fontSize: 12.5, fontWeight: 600, borderRadius: 6, border: "none", cursor: "pointer",
        background: active ? "#282D37" : "transparent",
        color: active ? "#ECEEF2" : "#868D99",
      }}
    >
      {children}
    </button>
  );
}

function ToolButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 6, border: "none", background: "transparent", color: "#868D99", cursor: "pointer",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#282D37")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}
