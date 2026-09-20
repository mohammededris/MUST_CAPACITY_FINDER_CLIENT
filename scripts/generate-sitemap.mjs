import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const configuredUrl =
  process.env.SITE_URL ||
  process.env.VITE_SITE_URL ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  process.env.VERCEL_URL ||
  "http://localhost:5173";

const siteUrl = configuredUrl.startsWith("http")
  ? configuredUrl
  : `https://${configuredUrl}`;
const normalizedSiteUrl = siteUrl.replace(/\/$/, "");
const outputDirectory = resolve("dist");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${normalizedSiteUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${normalizedSiteUrl}/support</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
`;

const robots = `User-agent: *
Allow: /
Disallow: /home

Sitemap: ${normalizedSiteUrl}/sitemap.xml
`;

await mkdir(outputDirectory, { recursive: true });
const indexPath = resolve(outputDirectory, "index.html");
const indexHtml = await readFile(indexPath, "utf8");
await Promise.all([
  writeFile(resolve(outputDirectory, "sitemap.xml"), sitemap),
  writeFile(resolve(outputDirectory, "robots.txt"), robots),
  writeFile(
    indexPath,
    indexHtml.replace("https://example.com/", `${normalizedSiteUrl}/`),
  ),
]);

console.log(`Generated sitemap and robots.txt for ${normalizedSiteUrl}`);