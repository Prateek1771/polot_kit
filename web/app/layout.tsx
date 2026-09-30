import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Shell } from "@/components/nav";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "PilotKit: AI Insurance Assistant, Tested Before Launch", template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "insurance",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website", siteName: SITE_NAME, locale: "en_IN", url: "/",
    title: "PilotKit: AI Insurance Assistant, Tested Before Launch", description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: "PilotKit: AI Insurance Assistant, Tested Before Launch", description: SITE_DESCRIPTION },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c10" },
  ],
};

// Structured data: what the site is (describes only what's actually on the page; no ratings or offers)
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: SITE_NAME, description: SITE_DESCRIPTION, inLanguage: "en-IN" },
    {
      "@type": "WebApplication", "@id": `${SITE_URL}/#app`, name: `${SITE_NAME} CoverWise Assistant`, url: `${SITE_URL}/chat`,
      applicationCategory: "FinanceApplication", operatingSystem: "Web", browserRequirements: "Requires JavaScript",
      description: "Chat or speak with an AI insurance assistant: see your own policies after sign-in, file and track claims, and compare insurance plans across insurers.",
      isPartOf: { "@id": `${SITE_URL}/#website` },
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }} />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
