import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The dev server blocks cross-origin requests to /_next/* by default. Reached
   * through an ngrok tunnel that means the HTML renders but its JavaScript is
   * refused — the page looks correct and nothing on it works, which reads as
   * "the buttons are broken" rather than as an asset problem.
   *
   * Development only; the production build ignores this.
   */
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok.io",
    "*.ngrok.app",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
