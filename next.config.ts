import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "nysxznkabusqmthihlpt.supabase.co", pathname: "/storage/v1/object/public/track-covers/**" }],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
