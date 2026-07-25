import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "path";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "motion",
      "framer-motion",
      "@base-ui/react",
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@libsql/client": path.resolve(
          "./node_modules/@libsql/client/lib-esm/web.js"
        ),
        "@libsql/client/web": path.resolve(
          "./node_modules/@libsql/client/lib-esm/web.js"
        ),
        // Exclude heavy Node-only PDF renderer from worker server bundle (~4.5 MB raw JS)
        "@react-pdf/renderer": false,
      };
    }
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  disableLogger: true,
});
