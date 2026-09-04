import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Backdrop } from "@/components/shell/backdrop";
import { ConsoleNote } from "@/components/shell/console-note";
import { Footer } from "@/components/shell/footer";
import { LookProvider } from "@/components/shell/look-provider";
import { Nav } from "@/components/shell/nav";
import { SocialsRail } from "@/components/shell/socials";
import { site } from "@/lib/data";
import { bootScript } from "@/lib/palette";
import "./globals.css";

// the typeface the site has always used. weights map to what the files actually are.
const avenir = localFont({
  variable: "--font-avenir",
  display: "swap",
  src: [
    { path: "./fonts/AvenirLTStd-Book.woff2", weight: "300", style: "normal" },
    { path: "./fonts/AvenirLTStd-Roman.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Avenir-Oblique.woff2", weight: "400", style: "italic" },
    { path: "./fonts/Avenir-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Avenir-Medium.woff2", weight: "700", style: "normal" },
    { path: "./fonts/AvenirLTStd-Black.woff2", weight: "800", style: "normal" },
    { path: "./fonts/AvenirLTStd-Black.woff2", weight: "900", style: "normal" },
  ],
});

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: `%s · ${site.name}` },
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${avenir.variable} ${geist.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
    >
      <head>
        {/* sets data-look and --hue before first paint so nothing flashes */}
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <LookProvider>
          <TooltipProvider delayDuration={350}>
            <Backdrop />
            <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 md:px-6">
              <SocialsRail />
              <Nav />
              <main className="flex-1 pt-10 md:pt-28">{children}</main>
              <Footer />
            </div>
            <ConsoleNote />
          </TooltipProvider>
        </LookProvider>
      </body>
    </html>
  );
}
