import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { AuthKeeper } from "@/components/AuthKeeper";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "אלמוגים · המוח הארגוני",
  description: "שכבת הבינה מעל כל המערכות של אלמוגים",
};

export const viewport: Viewport = {
  themeColor: "#090d13",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Never disable zoom — accessibility. The auto-zoom on focusing an input is
  // dealt with by font size in globals.css, not by taking pinch-zoom away.
  maximumScale: 5,
  // The on-screen keyboard shrinks the layout viewport rather than sliding
  // over it, so a pinned composer stays pinned above the keys instead of the
  // whole page scrolling out from under the user.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the inline script below stamps data-theme onto
    // <html> before React hydrates, so the server markup deliberately differs.
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint, so a light-mode user
            never sees a dark flash. Must run blocking, before the body. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('almogim-theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full">
        {/* Mirrors Firebase token refreshes into the server cookie. */}
        <AuthKeeper />
        {children}
      </body>
    </html>
  );
}
