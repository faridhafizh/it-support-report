/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["node:sqlite", "exceljs", "bcryptjs"],
  webpack: (config) => {
    // Disable symlink resolution on Windows to avoid Node 24 readlink EISDIR bug on regular files
    config.resolve.symlinks = false;
    return config;
  },
};

export default nextConfig;
