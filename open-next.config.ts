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
  // Keep node:crypto as edgeExternal for NextAuth token signing
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
