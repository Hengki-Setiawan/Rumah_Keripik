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
  // Required by @opennextjs/cloudflare to keep the worker bundle under the 3 MiB free tier limit.
  // Externalizing heavy libraries drastically reduces handler.mjs size.
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
    "bcryptjs"
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
