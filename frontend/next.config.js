const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NEXT_PUBLIC_API_URL / NEXT_PUBLIC_SOCKET_URL come from .env.local — see .env.local.example.
  // Backend runs as a separate service (see ../backend), not as Next.js API routes.
};

module.exports = withNextIntl(nextConfig);
