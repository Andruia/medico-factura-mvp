/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["192.168.2.12:3000", "192.168.2.12:3001", "localhost:3000", "localhost:3001"],
    },
    // We keep this here too, as per error message instructions
    allowedDevOrigins: ["192.168.2.12:3000", "192.168.2.12:3001", "localhost:3000", "localhost:3001"],
  },
}

export default nextConfig
