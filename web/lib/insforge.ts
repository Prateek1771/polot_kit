"use client";

import { createBrowserClient } from "@insforge/sdk/ssr";

/** Read-only InsForge client for the browser (current user, profile). Sign-in/out run as Server Actions (app/auth/actions.ts). */
export const insforge = createBrowserClient();

const ACCESS_COOKIE = "insforge_access_token"; // browser-readable by design; the refresh token stays httpOnly

function readCookie(name: string): string | null {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(name + "="));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

let signedOutUntil = 0; // after a refresh finds no session, skip refreshing for a while (a page makes several API calls)
let pending: Promise<string | null> | null = null;

/** A current InsForge access token for our API, refreshing through /api/auth/refresh when the cookie has expired. null = signed out. */
export async function accessToken(): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const t = readCookie(ACCESS_COOKIE);
  if (t) return t;
  if (Date.now() < signedOutUntil) return null;
  // the access cookie expires with the JWT; a still-valid httpOnly refresh cookie mints a new one (one request at a time)
  pending ??= fetch("/api/auth/refresh", { method: "POST" })
    .catch(() => undefined)
    .then(() => {
      const fresh = readCookie(ACCESS_COOKIE);
      if (!fresh) signedOutUntil = Date.now() + 30_000;
      return fresh;
    })
    .finally(() => { pending = null; });
  return pending;
}
