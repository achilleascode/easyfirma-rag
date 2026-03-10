import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "easyfirma.net",
      },
    ],
  },
};

export default nextConfig;
