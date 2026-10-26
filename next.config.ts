import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image ships only this self-contained server bundle (see Dockerfile).
  output: "standalone",
};

export default nextConfig;
