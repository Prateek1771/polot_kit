import type { Metadata } from "next";

const title = "Insurance Chatbot for Policies, Claims and Plans";
const description =
  "Chat or speak with CoverWise, an AI insurance assistant. Sign in to see your policy and file a claim, or compare health, car, bike, term and travel plans.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/chat" },
  openGraph: { title, description, url: "/chat" },
  twitter: { title, description },
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
