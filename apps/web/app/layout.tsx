// apps/web/app/layout.tsx
import type { Metadata, Viewport } from "next";
import InstallPwaBanner from "../components/InstallPwaBanner";

export const metadata: Metadata = {
  title: "RunServer",
  description: "Pay your infrastructure invoices in one place.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RunServer",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F1115",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0F1115" }}>
        {children}
        <InstallPwaBanner />
      </body>
    </html>
  );
}
