/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Increase stability for production builds
  reactStrictMode: true,
};

export default nextConfig;
