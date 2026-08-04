import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The dev-tools badge is a touch trap on a phone: dragging it calls
   * releasePointerCapture on an element that has already gone, which throws
   * NotFoundError and leaves the overlay swallowing taps for the rest of the
   * session. Compile and runtime errors are still reported without it.
   */
  devIndicators: false,

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
