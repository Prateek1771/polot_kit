"use client";

import { createBrowserClient } from "@insforge/sdk/ssr";

/** Read-only InsForge client for the browser (current user, profile). Sign-in/out run as Server Actions (app/auth/actions.ts). */
export const insforge = createBrowserClient();

const ACCESS_COOKIE = "insforge_access_token"; // browser-readable by design; the refresh token stays httpOnly

function readCookie(name: string): string | null {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(name + "="));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

/** A current InsForge access token for our API, refreshing through /api/auth/refresh when the cookie has expired. null = signed out. */
export async function accessToken(): Promise<string | null> {
  if (typeof document === "undefined") return null;
  let t = readCookie(ACCESS_COOKIE);
  if (!t) {
    // the access cookie expires with the JWT; a still-valid httpOnly refresh cookie mints a new one
    await fetch("/api/auth/refresh", { method: "POST" }).catch(() => undefined);
    t = readCookie(ACCESS_COOKIE);
  }
  return t;
}
