import { createRefreshAuthRouter } from "@insforge/sdk/ssr";

// Browser refresh endpoint: swaps the httpOnly refresh cookie for a fresh access-token cookie.
export const { POST } = createRefreshAuthRouter();
