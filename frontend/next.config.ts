import path from "node:path";

import type { NextConfig } from "next";

// Pin the project root so a stray lockfile in a parent directory is never
// mistaken for this app's workspace root.
const root = path.resolve(import.meta.dirname);

const nextConfig: NextConfig = {
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
