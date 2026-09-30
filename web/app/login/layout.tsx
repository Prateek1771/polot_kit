import type { Metadata } from "next";

// Account pages have no search value: keep them out of the index, but let crawlers follow links out.
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your CoverWise account to see your policies and claims.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
