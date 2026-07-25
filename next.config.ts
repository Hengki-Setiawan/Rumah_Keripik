import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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
};

export default process.env.DISABLE_SENTRY === "true"
  ? nextConfig
  : withSentryConfig(nextConfig, {
      silent: true,
      telemetry: false,
      widenClientFileUpload: true,
      tunnelRoute: "/monitoring",
      disableLogger: true,
    });
