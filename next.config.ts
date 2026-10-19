import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets a phone load the dev server through a cloudflare quick tunnel
  allowedDevOrigins: ["*.trycloudflare.com"],
  // the old site had these as separate pages. everything lives on the home page now.
  redirects() {
    return [
      { source: "/projects", destination: "/#work", permanent: false },
      { source: "/work", destination: "/#experience", permanent: false },
    ];
  },
};

export default nextConfig;
