import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@libsql/client",
    "@libsql/isomorphic-ws",
    "@libsql/hrana-client",
    "@react-pdf/renderer",
    "cloudinary",
    "@sentry/nextjs",
    "recharts",
    "lucide-react",
    "motion",
    "bcryptjs",
    "leaflet",
  ],
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});
