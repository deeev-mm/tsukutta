import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_JP, Shippori_Mincho } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const body = IBM_Plex_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body-loaded",
});

const display = Shippori_Mincho({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display-loaded",
});

export const metadata: Metadata = {
  title: "tsukutta",
  description:
    "気になるレシピの出典を残し、うちの版として保存・アレンジする。作ったら記録する。",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "tsukutta",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1f6b5c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${body.variable} ${display.variable}`}>
        <style>{`
          :root {
            --font-body: var(--font-body-loaded), "Hiragino Sans", sans-serif;
            --font-display: var(--font-display-loaded), "Hiragino Mincho ProN", serif;
          }
        `}</style>
        <ServiceWorkerRegister />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
