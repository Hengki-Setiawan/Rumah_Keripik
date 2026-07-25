import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "path";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Alias @libsql/client → @libsql/client/web so webpack bundles the
      // HTTP-fetch-only implementation directly. This eliminates the dynamic
      // import("@libsql/client") in the compiled output, which prevented
      // Cloudflare Workers (esbuild) from resolving the workerd export condition.
      config.resolve.alias = {
        ...config.resolve.alias,
        "@libsql/client": path.resolve(
          "./node_modules/@libsql/client/lib-esm/web.js"
        ),
        "@libsql/client/web": path.resolve(
          "./node_modules/@libsql/client/lib-esm/web.js"
        ),
      };
    }
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});
