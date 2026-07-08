import type { Metadata } from "next";
import { Inter, Hanken_Grotesk, JetBrains_Mono, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
  icons: {
    icon: [{ url: "/brand/rumah-keripik-mark.svg", type: "image/svg+xml" }],
    shortcut: ["/brand/rumah-keripik-mark.svg"],
    apple: ["/brand/rumah-keripik-mark.svg"],
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
