/** Canonical origin for metadata, sitemap and robots. Set NEXT_PUBLIC_SITE_URL for another domain. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://pilotkit.vercel.app").replace(/\/$/, "");

export const SITE_NAME = "PilotKit";
export const SITE_DESCRIPTION =
  "AI insurance assistant for customers and shoppers: check your policy, file a claim or compare 40 health, car, bike, term and travel plans. Tested in a Test Lab.";
