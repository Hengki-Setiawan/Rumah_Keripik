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
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

const sentryOptions: Parameters<typeof withSentryConfig>[1] = {
  silent: true,
  telemetry: false,
  widenClientFileUpload: true,
  disableLogger: true,
};

const shouldDisableSentry = process.env.DISABLE_SENTRY === "true" || !process.env.SENTRY_DSN;

export default shouldDisableSentry ? nextConfig : withSentryConfig(nextConfig, sentryOptions);
