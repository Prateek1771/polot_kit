import { LabGate } from "@/components/account";

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return <LabGate>{children}</LabGate>;
}
