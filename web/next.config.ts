import type { NextConfig } from "next";

// The app is fully client-side, so it is exported as static files (GitHub Pages).
// BASE_PATH is the sub-path it is served from, e.g. /enclosure-configurator.
const basePath = process.env.BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
