/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // TODO(phase-1): configure remotePatterns for Cloudflare R2 asset CDN once R2_* env vars exist.
  images: {
    remotePatterns: [],
  },
};

module.exports = nextConfig;
