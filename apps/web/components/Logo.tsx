// apps/web/components/Logo.tsx
interface LogoProps {
  variant?: "dark" | "light"; // "dark" = for use on dark backgrounds, "light" = on white
  height?: number;
}

/**
 * The real RS logo, wired in as two static assets rather than one
 * transparent cutout — the logo's white "S" is visually indistinguishable
 * from a plain white background, so automatic chroma-keying produces a
 * washed-out result. Using the pre-rendered dark/light versions from
 * public/logo/ instead is both simpler and more faithful to the source art.
 */
export default function Logo({ variant = "dark", height = 32 }: LogoProps) {
  const src = variant === "dark" ? "/logo/logo-mark-dark.png" : "/logo/logo-mark-light.png";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="RunServer" style={{ height, width: "auto", display: "block" }} />
  );
}
