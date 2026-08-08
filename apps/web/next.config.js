// apps/web/next.config.js
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @runserver/types ships raw TS from the workspace, not a pre-built
  // dist — tell Next to transpile it rather than treating it as an
  // opaque pre-compiled node_module.
  transpilePackages: ["@runserver/types"],
};

export default withPWA(nextConfig);
