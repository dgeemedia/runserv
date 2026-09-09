// apps/web/app/layout.tsx
import type { Metadata, Viewport } from "next";
import InstallPwaBanner from "../components/InstallPwaBanner";
import { SITE_URL, SITE_NAME } from "../lib/seo";
import { SOCIAL_LINKS } from "../lib/social";
import { OFFICES } from "../lib/offices";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "RunServ — Infrastructure billing, handled",
    template: "%s — RunServ",
  },
  description:
    "RunServ turns scattered infrastructure invoices into one dashboard. Clients see what they owe, pick what to pay, and check out in USD or NGN.",
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
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
    title: "RunServ",
  },
  openGraph: {
    title: "RunServ — Infrastructure billing, handled",
    description: "Pay your infrastructure invoices in one place.",
    siteName: SITE_NAME,
    url: SITE_URL,
    images: [{ url: "/social/og-image.png", width: 1200, height: 630, alt: "RunServ" }],
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "RunServ — Infrastructure billing, handled",
    description: "Pay your infrastructure invoices in one place.",
    images: ["/social/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0F1115",
  width: "device-width",
  initialScale: 1,
};

const ORG_ID = `${SITE_URL}/#organization`;

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ORG_ID,
  name: SITE_NAME,
  url: SITE_URL,
  sameAs: SOCIAL_LINKS.map((s) => s.href),
  contactPoint: OFFICES.map((o) => ({
    "@type": "ContactPoint",
    telephone: o.tel,
    email: o.email,
    contactType: "customer support",
    areaServed: o.region.includes("Nigeria") ? "West Africa" : ["GB", "US", "EU"],
  })),
  location: OFFICES.map((o) => ({
    "@type": "Place",
    name: o.region,
    address: {
      "@type": "PostalAddress",
      streetAddress: o.streetAddress,
      addressLocality: o.addressLocality,
      ...(o.postalCode ? { postalCode: o.postalCode } : {}),
      addressCountry: o.addressCountry,
    },
  })),
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description:
    "RunServ turns scattered infrastructure invoices into one dashboard. Clients see what they owe, pick what to pay, and check out in USD or NGN.",
  offers: {
    "@type": "Offer",
    category: "SaaS",
  },
  publisher: { "@id": ORG_ID },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
      </head>
      <body style={{ margin: 0, background: "#0F1115" }}>
        {children}
        <InstallPwaBanner />
      </body>
    </html>
  );
}
