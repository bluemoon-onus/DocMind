import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ["@aws-sdk/client-bedrock-runtime"],
  transpilePackages: ["pdfjs-dist"],
};

export default nextConfig;
