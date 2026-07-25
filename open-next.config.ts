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
  // Both `routes` and `patterns` are provided so OpenNext validateConfig passes.
  functions: {
    admin: {
      routes: [
        "app/(dashboard)/dashboard/page",
        "app/(dashboard)/keuangan/page",
        "app/(dashboard)/analitik/page",
        "app/(dashboard)/master-data/produk/page",
        "app/(dashboard)/master-data/pelanggan/page",
        "app/(dashboard)/master-data/varian-produk/page",
        "app/(dashboard)/master-data/kategori-produk/page",
        "app/(dashboard)/master-data/warung/page",
        "app/(dashboard)/master-data/zona-pengiriman/page",
        "app/api/admin/ai-budget/route",
      ],
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
        "api/admin/*",
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
