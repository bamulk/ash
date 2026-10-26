import type { Metadata } from "next";
import { Hanken_Grotesk, Jost } from "next/font/google";
import Script from "next/script";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./globals.css";

// Match the public site: Hanken Grotesk for body copy, Jost for display.
const bodyFont = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
const displayFont = Jost({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ashley Stone Homes",
  description: "Ashley Stone Homes — client, transaction & marketing management",
  applicationName: "Ashley Stone Homes",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Ashley Stone",
    // "default" gives the iOS status bar its own strip (coloured by
    // themeColor below) and starts the app under it. With
    // "black-translucent" the page ran under the status bar and iOS 27
    // blurred whatever scrolled there — the header included (WebKit
    // bug 324438). Phones read this when the app is added to the home
    // screen: an existing icon keeps the old setting, so delete and
    // re-add the icon on-device to pick up this change.
    statusBarStyle: "default",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
  interactiveWidget: "resizes-content" as const,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1d1d1b" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a18" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground font-sans">
        {children}
        <ServiceWorkerRegister />
        {mapsKey && (
          <Script
            id="google-maps-places"
            strategy="afterInteractive"
            src={`https://maps.googleapis.com/maps/api/js?key=${mapsKey}&libraries=places&v=weekly`}
          />
        )}
      </body>
    </html>
  );
}
