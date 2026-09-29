"use client";

import { FlaskConical, Inbox, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { ThemeToggle } from "@/components/pk";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Assistant", Icon: MessagesSquare, match: (p: string) => p === "/" },
  { href: "/lab", label: "Test Lab", Icon: FlaskConical, match: (p: string) => p.startsWith("/lab") && !p.startsWith("/lab/review") },
  { href: "/lab/review", label: "Review", Icon: Inbox, match: (p: string) => p.startsWith("/lab/review") },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
        <div className="mx-auto flex h-14 max-w-[78rem] items-center gap-2 rounded-2xl border border-white/60 bg-card/75 px-3 shadow-soft backdrop-blur-xl supports-[backdrop-filter]:bg-card/65 dark:border-border sm:px-4">
          <Link href="/" className="mr-2 flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M4 12h4l3-7 3 14 3-7h3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="hidden text-[17px] sm:inline">PilotKit</span>
          </Link>
          <nav className="flex items-center gap-0.5" aria-label="Main">
            {LINKS.map(({ href, label, Icon, match }) => (
              <Link
                key={href}
                href={href}
                aria-current={match(path) ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  match(path) && "bg-secondary text-secondary-foreground font-medium hover:bg-secondary hover:text-secondary-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border bg-background/60 px-2.5 py-1 text-xs text-muted-foreground md:inline-flex">
              <span className="size-1.5 rounded-full bg-jev" /> decisions by Jev 1.13
            </span>
            <ThemeToggle />
            <Link href="/lab" className="hidden h-9 items-center rounded-full bg-ink px-4 text-sm font-medium text-ink-foreground transition-opacity hover:opacity-90 sm:inline-flex">
              Run a suite
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <Toaster richColors position="bottom-right" />
    </ThemeProvider>
  );
}
