import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/isomorphic-ws", "@libsql/client"],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "motion",
      "@base-ui/react",
    ],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' http://localhost:3000 http://localhost:3001 https://presentasi-magang.vercel.app",
          },
        ],
      },
    ]
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
