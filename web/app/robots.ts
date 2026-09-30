import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// /lab and /login stay crawlable so bots can read their noindex; only the auth API is off limits.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
