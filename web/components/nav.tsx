"use client";

import { ChatsCircle, Flask, House, IconContext, Tray } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { Cta, ThemeToggle } from "@/components/pk";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Home", Icon: House, match: (p: string) => p === "/" },
  { href: "/chat", label: "Assistant", Icon: ChatsCircle, match: (p: string) => p.startsWith("/chat") },
  { href: "/lab", label: "Test Lab", Icon: Flask, match: (p: string) => p.startsWith("/lab") && !p.startsWith("/lab/review") },
  { href: "/lab/review", label: "Review", Icon: Tray, match: (p: string) => p.startsWith("/lab/review") },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 pl-1 pr-2 font-semibold tracking-tight" aria-label="PilotKit home">
      <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_20px_-6px_rgb(99_91_255/70%)]">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M4 12h4l3-7 3 14 3-7h3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="pk-display text-[17px]">PilotKit</span>
    </Link>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) { setLastPath(path); setOpen(false); } // close the overlay on navigation

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <IconContext.Provider value={{ weight: "light" }}>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2">
          Skip to content
        </a>
        <div className="pk-grain" aria-hidden />

        {/* Fluid island: a floating glass pill, never glued edge-to-edge */}
        <header className="pointer-events-none sticky top-0 z-40 flex justify-center px-3 pt-3 sm:pt-4">
          <div className="pointer-events-auto flex h-14 w-full max-w-md items-center gap-1 rounded-full bg-card/70 px-2 shadow-soft ring-1 ring-foreground/[0.06] backdrop-blur-xl supports-[backdrop-filter]:bg-card/55 dark:ring-white/10 md:w-max md:max-w-none">
            <Logo />
            <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
              {LINKS.map(({ href, label, Icon, match }) => (
                <Link key={href} href={href} aria-current={match(path) ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
                    match(path) && "bg-secondary font-medium text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground",
                  )}>
                  <Icon className="size-[18px]" aria-hidden /> {label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-1 md:ml-2">
              <span className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted-foreground lg:inline-flex">
                <span className="size-1.5 rounded-full bg-jev shadow-[0_0_10px_var(--jev)]" /> Jev 1.13
              </span>
              <ThemeToggle />
              <div className="hidden md:block"><Cta href="/lab" className="py-1.5 pl-4 text-[13px]">Run a suite</Cta></div>
              {/* hamburger: two lines morph into an X */}
              <button onClick={() => setOpen((o) => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}
                className="relative grid size-10 place-items-center rounded-full hover:bg-foreground/[0.05] md:hidden">
                <span className={cn("absolute h-px w-5 bg-foreground transition-transform duration-500", open ? "rotate-45" : "-translate-y-[4px]")} />
                <span className={cn("absolute h-px w-5 bg-foreground transition-transform duration-500", open ? "-rotate-45" : "translate-y-[4px]")} />
              </button>
            </div>
          </div>
        </header>

        {/* mobile overlay: heavy glass, staggered mask reveal of links */}
        <div className={cn("fixed inset-0 z-30 flex flex-col justify-center bg-background/80 px-8 backdrop-blur-3xl transition-opacity duration-500 md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={!open}>
          <nav className="flex flex-col gap-2" aria-label="Mobile">
            {LINKS.map(({ href, label, match }, i) => (
              <div key={href} className="overflow-hidden">
                <Link href={href} tabIndex={open ? 0 : -1}
                  style={{ transitionDelay: open ? `${100 + i * 50}ms` : "0ms" }}
                  className={cn("pk-display block py-1 text-5xl font-medium transition-[transform,opacity] duration-700",
                    open ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0", match(path) ? "text-primary" : "text-foreground")}>
                  {label}
                </Link>
              </div>
            ))}
          </nav>
        </div>

        <main id="main" className="flex-1">{children}</main>
        <Toaster richColors position="bottom-right" />
      </IconContext.Provider>
    </ThemeProvider>
  );
}
