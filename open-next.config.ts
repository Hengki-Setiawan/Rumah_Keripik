// @ts-check
/** @type {import("@opennextjs/cloudflare").CloudflareConfig} */
const config = {
  default: {
    minify: true,
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
  },
  // Split Admin Dashboard into a separate Worker function using OpenNext route patterns.
  // This keeps the default Worker (Storefront & Public APIs) super lightweight.
  functions: {
    admin: {
      patterns: [
        "dashboard",
        "keuangan",
        "analitik",
        "master-data/*",
        "pembayaran/*",
        "kurir/*",
        "ai-workspace/*",
        "ai-ops",
        "ai-monitor",
        "ai-skills",
        "bot-config",
        "knowledge-base",
        "model-router",
        "slo-dashboard",
        "sos",
        "transaksi",
        "web-sessions",
        "failed-conversations",
        "feedback-learning",
        "hub-komunikasi",
        "audit-ai",
        "admin-guide",
        "ops-smoke",
        "api/admin/*"
      ],
      override: {
        wrapper: "cloudflare-node",
        converter: "edge",
        proxyExternalRequest: "fetch",
        incrementalCache: "dummy",
        tagCache: "dummy",
        queue: "dummy",
      },
    },
  },
  edgeExternals: ["node:crypto"],
  middleware: {
    external: true,
    minify: true,
    override: {
      wrapper: "cloudflare-edge",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
  },
};

export default config;
