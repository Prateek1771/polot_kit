import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@insforge/sdk/ssr/middleware";

// Keep InsForge auth cookies fresh before pages render (Next 16 "proxy", formerly middleware).
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  await updateSession({ requestCookies: request.cookies, responseCookies: response.cookies });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|webp|ico|webm)$).*)"],
};
