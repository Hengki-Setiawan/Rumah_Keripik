import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@libsql/isomorphic-ws",
    "@libsql/client",
    "@jridgewell/trace-mapping",
    "@jridgewell/sourcemap-codec",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "motion",
      "@base-ui/react",
    ],
  },
};

const sentryOptions: Parameters<typeof withSentryConfig>[1] = {
  silent: true,
  telemetry: false,
  widenClientFileUpload: true,
  disableLogger: true,
};

const shouldDisableSentry = process.env.DISABLE_SENTRY === "true";

export default shouldDisableSentry ? nextConfig : withSentryConfig(nextConfig, sentryOptions);
