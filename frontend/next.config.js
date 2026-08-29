const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NEXT_PUBLIC_API_URL / NEXT_PUBLIC_SOCKET_URL come from .env.local — see .env.local.example.
  // Backend runs as a separate service (see ../backend), not as Next.js API routes.
  experimental: {
    serverActions: {
      // Server Actions default to a 1MB request body, which a single
      // attachment already exceeds. uploadAttachments forwards up to 10
      // files (backend/src/middleware/upload.ts's per-request cap) through
      // one action call, each up to the 3MB per-file limit there — so this
      // needs headroom for 10 * 3MB plus multipart overhead, not just one file.
      bodySizeLimit: "35mb",
    },
  },
};

module.exports = withNextIntl(nextConfig);
