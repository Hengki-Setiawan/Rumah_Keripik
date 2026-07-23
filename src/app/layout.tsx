import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rumah Keripik",
  description: "Workspace pemesanan dan dashboard operasional Rumah Keripik",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/brand/rumah-keripik-mark.png", type: "image/png" }],
    shortcut: ["/brand/rumah-keripik-mark.png"],
    apple: ["/brand/rumah-keripik-mark.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={cn("h-full", "antialiased", hankenGrotesk.variable, jetbrainsMono.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
