import type { OpenNextConfig } from "@opennextjs/aws/types/open-next.js";

const config: OpenNextConfig = {
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
  edgeExternals: [
    "node:crypto",
    "@libsql/client",
    "@libsql/client/web",
    "@libsql/client/http",
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
