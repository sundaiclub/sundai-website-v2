import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./fonts.css";
import Navbar from "./components/navbar";
import { ClerkProvider } from "@clerk/nextjs";
import { UserProvider } from "./contexts/UserContext";
import { ThemeProvider } from './contexts/ThemeContext';
import { Analytics } from "@vercel/analytics/react"
import { PostHogProvider } from './providers'
import { Providers } from './components/Providers';
import ExternalLinkBehavior from './components/ExternalLinkBehavior';
import { Space_Mono, Fira_Code } from 'next/font/google'
import Script from 'next/script';
import { DEFAULT_SOCIAL_IMAGE_URL, PUBLIC_APP_URL } from '@/lib/siteUrl';

const inter = Inter({ subsets: ["latin"] });

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
})

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-fira-code',
})

export const metadata: Metadata = {
  title: "Sundai Club",
  description: "Building & Launching AI Prototypes Every Sunday",
  metadataBase: new URL(PUBLIC_APP_URL),
  openGraph: {
    type: "website",
    siteName: "Sundai Club",
    title: "Sundai Club",
    description: "Building & Launching AI Prototypes Every Sunday",
    images: [
      {
        url: DEFAULT_SOCIAL_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Sundai Club Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sundai Club",
    description: "Building & Launching AI Prototypes Every Sunday",
    images: [DEFAULT_SOCIAL_IMAGE_URL],
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PostHogProvider>
      <ClerkProvider>
        <UserProvider>
          <html lang="en">
          <head>
            <meta name="apple-mobile-web-app-title" content="Sundai" />
          </head>
          <body
            className={`${inter.className} h-screen ${spaceMono.variable} ${firaCode.variable}`}
            style={{
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "none",
            }}
          >
            <ExternalLinkBehavior />
            <Analytics/>
            <Script src="https://www.googletagmanager.com/gtag/js?id=G-HV7HE6PBDD" strategy="afterInteractive" />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', 'G-HV7HE6PBDD');
              `}
            </Script>
            <Providers>
              <Navbar />
              <div className="origin-top-left min-h-screen pt-16">
                {children}
              </div>
            </Providers>
          </body>
        </html>
      </UserProvider>
    </ClerkProvider>
  </PostHogProvider>
  );
}
