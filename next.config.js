/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained Node server output for host-managed deploys (e.g. Hostinger
  // Node.js apps). Produces .next/standalone with a runnable server.js.
  output: "standalone",
  // TODO(phase-1): configure remotePatterns for Cloudflare R2 asset CDN once R2_* env vars exist.
  images: {
    remotePatterns: [],
  },
};

module.exports = nextConfig;
