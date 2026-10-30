import path from "node:path";

import type { NextConfig } from "next";

// Pin the project root so a stray lockfile in a parent directory is never
// mistaken for this app's workspace root.
const root = path.resolve(import.meta.dirname);

const nextConfig: NextConfig = {
  // E2E_DEV runs get their own output folder so they never clash with a `next dev` you already have open.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingRoot: root,
  turbopack: {
    root,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
