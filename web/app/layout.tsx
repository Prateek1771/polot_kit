import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Shell } from "@/components/nav";
import "./globals.css";

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PilotKit — CoverWise Assistant + Test Lab",
  description: "An insurance assistant for customers and shoppers, with Jev decisions, simulated-user testing and a calibrated review queue.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
