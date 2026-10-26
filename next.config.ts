import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image ships only this self-contained server bundle (see Dockerfile).
  output: "standalone",
  // Nodemailer reaches for Node's `dns`/`net`/`tls` at runtime, which the server
  // bundler cannot inline; leave it as a real dependency in node_modules.
  serverExternalPackages: ["nodemailer"],
};

export default nextConfig;
