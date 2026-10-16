import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono } from "next/font/google";
import { ConsoleNote } from "@/components/shell/console-note";
import { PixelOutro } from "@/components/pixel-outro";
import { SiteHeader } from "@/components/site-header";
import { site } from "@/lib/data";
import { bootScript } from "@/lib/boot";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  display: "swap",
});
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name}, ${site.role.toLowerCase()}`, template: `%s · ${site.name}` },
  description: site.tagline,
  authors: [{ name: site.name }],
  openGraph: {
    title: site.name,
    description: site.tagline,
    url: site.url,
    siteName: site.name,
    locale: "en_US",
    type: "website",
    images: [{ url: site.ogImage, width: 1200, height: 630, alt: site.name }],
  },
  twitter: {
    card: "summary_large_image",
    creator: site.twitterHandle,
    title: site.name,
    description: site.tagline,
    images: [site.ogImage],
  },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f12" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bricolage.variable} ${geistMono.variable}`}
    >
      <head>
        {/* sets the theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-dvh text-[1rem] leading-[1.6] md:text-[1.0625rem]">
        <div className="mx-auto w-full max-w-[52rem] px-5 [--gutter:2.5rem] [--margin:8.5rem] md:px-8">
          <SiteHeader />
          <main>{children}</main>
        </div>
        <PixelOutro />
        <ConsoleNote />
      </body>
    </html>
  );
}
