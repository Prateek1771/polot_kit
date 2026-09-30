import type { Metadata } from "next";
import { LabGate } from "@/components/account";

// Staff-only tool behind sign-in: never indexed.
export const metadata: Metadata = {
  title: "Test Lab",
  description: "Staff-only Test Lab for simulated-user runs, readiness reports and the human review queue.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/lab" },
};

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return <LabGate>{children}</LabGate>;
}
