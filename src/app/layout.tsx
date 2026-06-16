import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Ashley Stone Homes",
  description: "Ashley Stone Homes — client, transaction & marketing management",
  applicationName: "Ashley Stone Homes",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Ashley Stone",
    // black-translucent lets the iOS status bar adapt to whatever the
    // page paints underneath — matches the rest of our dark/light theme.
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
  interactiveWidget: "resizes-content" as const,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e3a5f" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
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
