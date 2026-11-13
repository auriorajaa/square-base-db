import type {Metadata, Viewport} from "next";
import {Geist, Geist_Mono, Instrument_Sans} from "next/font/google";
import "./globals.css";
import {cn} from "@/lib/utils";
import {TooltipProvider} from "@/components/ui/tooltip";

const instrumentSans = Instrument_Sans({subsets: ["latin"], variable: "--font-sans"});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "A small backend for side projects. Postgres, auth, file storage, realtime, and a REST API in one dashboard.";

export const metadata: Metadata = {
  applicationName: "Square Base",
  title: {
    default: "Square Base",
    template: "%s · Square Base",
  },
  description: DESCRIPTION,
  keywords: [
    "Square Base",
    "Square Base DB",
    "Postgres backend",
    "backend as a service",
    "authentication",
    "file storage",
    "realtime",
    "REST API",
    "Aurio Rajaa",
  ],
  authors: [{name: "Aurio Rajaa", url: "https://aurio.work"}],
  creator: "Aurio Rajaa",
  publisher: "Aurio Rajaa",
  category: "developer tools",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Square Base",
    locale: "en_US",
    title: "Square Base",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: "Square Base",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#5417D7",
  colorScheme: "light dark",
};

export default function RootLayout({children}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", instrumentSans.variable)}
    >
    <body className="min-h-full flex flex-col"><TooltipProvider>{children}</TooltipProvider></body>
    </html>
  );
}
