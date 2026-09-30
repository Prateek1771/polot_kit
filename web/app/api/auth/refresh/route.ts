import { type NextRequest } from "next/server";
import { createRefreshAuthRouter, getRefreshTokenCookieName } from "@insforge/sdk/ssr";

const { POST: refresh } = createRefreshAuthRouter();

// Browser refresh endpoint: swaps the httpOnly refresh cookie for a fresh access-token cookie.
// No refresh cookie = simply signed out: answer 204 instead of a 401 that shows up as a console error on every page.
export async function POST(request: NextRequest) {
  if (!request.cookies.has(getRefreshTokenCookieName())) return new Response(null, { status: 204 });
  return refresh(request);
}
