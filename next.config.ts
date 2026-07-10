import type { NextConfig } from "next";

const allowedOrigins = ["localhost:3000"];

// Ajoute le domaine VPS si défini (ex: "admin.ndawwune.sn" ou "1.2.3.4:3000")
if (process.env.NEXT_PUBLIC_APP_ORIGIN) {
  allowedOrigins.push(process.env.NEXT_PUBLIC_APP_ORIGIN);
}

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: { allowedOrigins },
  },
};

export default nextConfig;
