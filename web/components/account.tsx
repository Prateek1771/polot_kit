"use client";

import { LockKey, SignIn, SignOut } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/auth/actions";
import { Empty } from "@/components/pk";
import { Skeleton } from "@/components/ui/skeleton";
import { get, type Me } from "@/lib/api";

const SIGNED_OUT: Me = { user: null, lab: false };

/** Who the API thinks is signed in (and whether they are Test Lab staff). undefined while loading. */
export function useMe() {
  const path = usePathname();
  const [me, setMe] = useState<Me | undefined>(undefined);
  useEffect(() => {
    let live = true;
    get<Me>("/me").then((m) => live && setMe(m)).catch(() => live && setMe(SIGNED_OUT));
    return () => { live = false; };
  }, [path]);
  return me;
}

/** Nav control: "Sign in", or the account's initial with a sign-out button. */
export function AccountButton() {
  const me = useMe();
  const path = usePathname();
  const router = useRouter();
  if (me === undefined) return <span className="size-10" aria-hidden />;
  if (!me.user) {
    return (
      <Link href={`/login?next=${encodeURIComponent(path)}`}
        className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground">
        <SignIn className="size-[18px]" aria-hidden /> <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  }
  const email = me.user.email;
  return (
    <span className="inline-flex items-center gap-1">
      <span title={email} className="grid size-8 place-items-center rounded-full bg-primary/12 text-xs font-semibold uppercase text-primary">
        {email[0]}
      </span>
      <button type="button" aria-label={`Sign out ${email}`} title="Sign out"
        onClick={async () => { await signOut(); router.refresh(); router.push("/"); }}
        className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground">
        <SignOut className="size-[18px]" aria-hidden />
      </button>
    </span>
  );
}

/** Test Lab gate: signed-out users go to /login; signed-in non-staff see why they can't enter. The API enforces the same rule. */
export function LabGate({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const path = usePathname();
  const router = useRouter();
  const signedOut = me !== undefined && !me.user;
  useEffect(() => { if (signedOut) router.replace(`/login?next=${encodeURIComponent(path)}`); }, [signedOut, path, router]);

  if (me === undefined || signedOut) return <div className="mx-auto max-w-7xl px-4 py-8"><Skeleton className="h-64" /></div>;
  if (!me.lab) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Empty icon={LockKey} title="The Test Lab is for CoverWise staff">
          You&apos;re signed in as {me.user?.email}, which isn&apos;t on the staff list. Ask an admin to add it to LAB_ADMIN_EMAILS.
        </Empty>
      </div>
    );
  }
  return <>{children}</>;
}
