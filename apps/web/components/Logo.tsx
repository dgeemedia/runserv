// apps/web/components/Logo.tsx
interface LogoProps {
  variant?: "dark" | "light"; // "dark" = transparent, for dark backgrounds. "light" = opaque white bg, for light contexts (emails)
  height?: number;
}

/**
 * The real RS logo. Two source files, not one, because the mark's
 * white "S" is visually indistinguishable from a plain white
 * background — a single transparent asset looks great on dark UI but
 * washes out on white. So:
 *  - "dark": a proper transparent cutout (public/logo/logo-mark-transparent.png),
 *    recovered via premultiplied-alpha-over-black extraction, not a naive
 *    chroma-key — used everywhere in this dark-themed app.
 *  - "light": an opaque, pre-rendered white-background version, for the
 *    one place this app renders on white (the Brevo email header).
 */
export default function Logo({ variant = "dark", height = 32 }: LogoProps) {
  const src = variant === "dark" ? "/logo/logo-mark-transparent.png" : "/logo/logo-mark-light.png";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="RunServ" style={{ height, width: "auto", display: "block" }} />
  );
}

