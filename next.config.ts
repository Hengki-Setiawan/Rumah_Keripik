import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});
