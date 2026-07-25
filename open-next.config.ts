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
  // Multi-Worker function splitting: splits the large Next.js app into separate
  // server functions to keep each individual Worker script well under 3 MiB limit.
  functions: {
    adminApi: {
      routes: ["app/api/admin/*", "app/api/analytics/*"],
      patterns: ["api/admin/*", "api/analytics/*"],
      override: {
        wrapper: "cloudflare-node",
        converter: "edge",
        proxyExternalRequest: "fetch",
        incrementalCache: "dummy",
        tagCache: "dummy",
        queue: "dummy",
      },
    },
    publicApi: {
      routes: [
        "app/api/public/*",
        "app/api/chat/*",
        "app/api/courier/*",
        "app/api/loyalty/*",
        "app/api/order/*",
        "app/api/webhook/*",
      ],
      patterns: [
        "api/public/*",
        "api/chat/*",
        "api/courier/*",
        "api/loyalty/*",
        "api/order/*",
        "api/webhook/*",
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
  edgeExternals: [
    "node:crypto",
    "@react-pdf/renderer",
    "@react-pdf/pdfkit",
    "@react-pdf/font",
    "@react-pdf/layout",
    "@react-pdf/png-js",
    "recharts",
    "lucide-react",
    "motion",
    "leaflet",
    "bcryptjs",
  ],
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
