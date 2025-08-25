/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    // unoptimized: true,
    domains: [
      "img.clerk.com",
      "images.clerk.dev",
      "www.gravatar.com",
      "storage.googleapis.com",
      "replicate.delivery",
    ],
  },
  experimental: {
    esmExternals: 'loose'
  }
};

export default nextConfig;
