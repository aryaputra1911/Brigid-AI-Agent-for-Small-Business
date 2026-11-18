import type { Metadata, Viewport } from "next";
import "@fontsource/outfit/latin-400.css";
import "@fontsource/outfit/latin-500.css";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#07020a",
};

export const metadata: Metadata = {
  title: "Brigid | AI finance agent for small business",
  description:
    "A local simulation workspace for financial conversations and approvals.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Brigid",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/brand/brigid.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
    apple: [
      { url: "/brand/brigid-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
